const express = require("express")
const bodyParser = require("body-parser")
const axios = require("axios")
const Recaptcha = require("express-recaptcha").RecaptchaV2
const multer = require("multer")
const fs = require("fs")
const path = require("path")

const app = express()
const port = process.env.PORT || 3000

// Adicionar middleware para CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  
  // Responder imediatamente a requisições OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "uploads");
    // Ensure uploads directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  }
})

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
})

// In production, store credentials in environment variables
const ZENDESK_SUBDOMAIN = "pottd.zendesk.com"
const ZENDESK_USER_EMAIL = "hello@getpottd.com"
const ZENDESK_API_TOKEN = "7TPcWrjMTEoavMX1BS7lTvgLlDrhdiRMioGbqZjD"
const RECAPTCHA_SITE_KEY = "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"
const RECAPTCHA_SECRET_KEY = "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe"

const recaptcha = new Recaptcha(RECAPTCHA_SITE_KEY, RECAPTCHA_SECRET_KEY)

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

// Manter a página informativa na raiz
app.get("/", (req, res) => {
  res.send(`
    <h1>Ticket Form API</h1>
    <p>Este é um servidor de API para processamento de formulários de contato.</p>
    <p>Para enviar um formulário, faça uma requisição POST para /submit.</p>
  `);
});

// Mover o formulário para /form
app.get("/form", recaptcha.middleware.render, (req, res) => {
  const form = `
    <form action="/submit" method="post" enctype="multipart/form-data">
    <div>
        <label for="subject">Subject</label><br>
        <input type="text" name="subject" required><br>
        <label for="description">Description</label><br>
        <textarea name="description" rows="6" required></textarea><br>
        <label for="shopify_order_id">Shopify Order ID</label><br>
        <input type="text" name="shopify_order_id"><br>
        <label for="attachment">Attachment (optional, max 5MB)</label><br>
        <input type="file" name="attachment"><br>
        <label for="name">Name</label><br>
        <input type="text" name="name" required><br>
        <label for="email">Email</label><br>
        <input type="email" name="email" required><br><br>
    </div>
    <div>
        ${recaptcha.render()}
    </div>
    <div>
        <button>Submit</button>
    </div>
    </form>
`
  res.send(form)
})

app.post("/submit", recaptcha.middleware.verify, upload.single('attachment'), async (req, res) => {
  if (!req.recaptcha.error) {
    try {
      console.log('Form data received:', req.body);
      
      // Prepare description text with Order ID if provided
      let descriptionText = req.body.description;
      if (req.body.shopify_order_id) {
        descriptionText = `Shopify Order ID: ${req.body.shopify_order_id}\n\n${descriptionText}`;
      }
      
      // Base request data without attachments
      const requestData = {
        request: {
          subject: req.body.subject,
          comment: {
            body: descriptionText
          },
          requester: {
            name: req.body.name,
            email: req.body.email
          }
        }
      };
      
      // Handle file attachment if present
      if (req.file) {
        console.log('File uploaded:', req.file);
        
        // First upload the file to Zendesk
        const fileContent = fs.readFileSync(req.file.path);
        const fileUploadResponse = await axios({
          method: 'POST',
          url: `https://${ZENDESK_SUBDOMAIN}/api/v2/uploads.json?filename=${encodeURIComponent(req.file.originalname)}`,
          headers: {
            'Content-Type': 'application/binary',
            'Accept': 'application/json'
          },
          auth: {
            username: `${ZENDESK_USER_EMAIL}/token`,
            password: ZENDESK_API_TOKEN
          },
          data: fileContent,
          validateStatus: () => true
        });
        
        if (fileUploadResponse.status >= 200 && fileUploadResponse.status < 300) {
          console.log('File uploaded to Zendesk:', fileUploadResponse.data);
          
          // Add the token to the request
          requestData.request.comment.uploads = [fileUploadResponse.data.upload.token];
        } else {
          console.error('Failed to upload file to Zendesk:', fileUploadResponse.status, fileUploadResponse.data);
        }
        
        // Clean up the temporary file
        fs.unlinkSync(req.file.path);
      }
      
      const options = {
        method: "POST",
        url: `https://${ZENDESK_SUBDOMAIN}/api/v2/requests.json`,
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        auth: {
          username: `${ZENDESK_USER_EMAIL}/token`,
          password: ZENDESK_API_TOKEN
        },
        data: requestData,
        validateStatus: () => true
      };

      console.log('Sending request to Zendesk with options:', {
        method: options.method,
        url: options.url,
        headers: options.headers,
        auth: {
          username: options.auth.username,
          password: '***'
        },
        data: options.data
      });

      const response = await axios(options);
      
      if (response.status >= 200 && response.status < 300) {
        console.log('Zendesk response success:', response.status, response.data);
        res.status(200).send("Form submitted successfully");
      } else {
        console.error('Zendesk error response:', response.status, response.data);
        res.status(500).send("Error submitting your request. Please try again later.");
      }
    } catch (error) {
      console.error('Exception caught:', error.message);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      res.status(500).send("An unexpected error occurred. Please try again later.");
    }
  } else {
    console.error('reCAPTCHA verification failed:', req.recaptcha.error);
    res.status(400).send("reCAPTCHA verification failed");
  }
})

app.listen(port, () => {
  console.log(
    `Server running on port ${port}. Visit http://localhost:${port}`
  )
})