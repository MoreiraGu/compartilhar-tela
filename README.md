# ScreenShare — compartilhamento de tela tipo Discord

App web para compartilhar tela em tempo real com outras pessoas, direto do
navegador (sem instalar nada quem participa). Usa **WebRTC** (peer-to-peer:
o vídeo vai direto entre os participantes, não passa pelo servidor) e um
servidor **Node.js + Socket.io** só para "apresentar" os participantes uns
aos outros (sinalização).

## O que tem

- Salas por nome (ex: `reuniao-time`)
- Compartilhar tela (com opção de parar a qualquer momento)
- Microfone opcional
- Chat de texto na sala
- Link de convite (botão "Copiar convite")
- Funciona com várias pessoas na mesma sala (mesh: cada um conecta com todos)

## Rodando localmente

```bash
npm install
npm start
```

Abra `http://localhost:3000` no navegador. Para testar com duas "pessoas"
na sua própria máquina, abra duas abas/janelas.

## Rodando com Docker (local)

```bash
docker compose up --build
```

Abre em `http://localhost:3000`. Pra rodar sem docker-compose:

```bash
docker build -t screenshare .
docker run -p 3000:3000 screenshare
```

## Colocando na internet de graça (com Docker)

O servidor de sinalização (`server.js`) precisa estar acessível publicamente.
**Render.com** tem o jeito mais direto de subir isso de graça usando o
Dockerfile que já está no projeto:

1. Suba o projeto pro GitHub (crie um repo e faça `git push`).
2. Entre em [render.com](https://render.com) → **New** → **Web Service**.
3. Conecte o repositório.
4. Em "Runtime", escolha **Docker** (o Render detecta o `Dockerfile` sozinho).
5. Plano: **Free**.
6. Clique em **Create Web Service**.

Pronto — o Render builda a imagem e te dá uma URL pública tipo
`https://screenshare-xxxx.onrender.com`. É essa URL que você compartilha
com quem for entrar na sala.

⚠️ **Detalhe do plano free do Render**: o serviço "dorme" depois de ~15 min
sem uso, e demora uns 30-50s pra acordar no próximo acesso. Pra uso
esporádico é ótimo; pra usar toda hora, considere o plano pago (bem barato)
ou outra opção abaixo.

### Alternativas gratuitas também com Docker

- **Fly.io** — `flyctl launch` na pasta do projeto (detecta o Dockerfile),
  tem um free allowance mensal de máquinas pequenas.
- **Railway.app** — free trial com créditos; depois disso é pago.
- Para testes rápidos sem deploy nenhum: rode local (`docker compose up`)
  e exponha com **ngrok** (`ngrok http 3000`) — gera um link público
  temporário, sem precisar publicar em lugar nenhum.

Depois do deploy, todo mundo acessa a mesma URL pública, entra na mesma
sala pelo nome, e a conexão de vídeo é direta entre os navegadores.

## Sobre redes restritas (⚠️ importante)

O projeto usa servidores **STUN** públicos do Google para ajudar os
navegadores a se encontrarem atrás de roteadores/NAT — funciona na
grande maioria dos casos (casa, 4G, a maioria dos escritórios).

Em redes **muito restritas** (firewalls corporativos fechados, certas
redes públicas), pode ser necessário um servidor **TURN** — que retransmite
o vídeo quando a conexão direta não é possível. Serviços como
[Metered](https://www.metered.ca/tools/openrelay/) ou
[Twilio TURN](https://www.twilio.com/docs/stun-turn) oferecem isso.
Se precisar, é só adicionar as credenciais no array `ICE_SERVERS`, em
`public/client.js`.

## Estrutura

```
screenshare/
├── server.js          servidor Express + Socket.io (sinalização)
├── package.json
└── public/
    ├── index.html      tela de entrada + sala
    ├── style.css        tema escuro
    └── client.js        WebRTC: conexões, compartilhar tela, chat
```

## Possíveis próximos passos

- Autenticação / salas privadas com senha
- Gravação da chamada
- Compartilhar tela com áudio do sistema (hoje só compartilha o áudio do
  mic, se ativado — `getDisplayMedia` também suporta capturar áudio da
  aba/sistema em navegadores compatíveis)
- Deploy com TURN próprio (coturn) para garantir conexão em qualquer rede
