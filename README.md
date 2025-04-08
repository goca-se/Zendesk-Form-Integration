# Formulário de Suporte com Integração Zendesk

Este projeto consiste em uma aplicação web simples que permite aos usuários enviar solicitações de suporte através de um formulário, que são então encaminhadas para o Zendesk.

## Funcionalidades

- Formulário web para envio de solicitações de suporte
- Integração com a API do Zendesk para criação de tickets
- Suporte para upload de arquivos (até 5MB)
- Preenchimento automático do formulário via parâmetros de URL
- Submissão automática quando todos os campos obrigatórios estão presentes na URL

## Requisitos

- Node.js
- npm ou yarn
- Conta no Zendesk

## Dependências

- express: Framework web para Node.js
- body-parser: Middleware para processar dados de requisições
- axios: Cliente HTTP para fazer requisições à API do Zendesk
- multer: Middleware para lidar com upload de arquivos
- dotenv: Para carregar variáveis de ambiente

