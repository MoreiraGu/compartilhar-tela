# ScreenShare Desktop

Versão em app (Electron) do ScreenShare — seus amigos instalam um `.exe`
normal no Windows, sem precisar de navegador, Node ou nada técnico. O app
se conecta no seu servidor de sinalização hospedado no Render.

## 1. Configure a URL do seu servidor

Abra `public/config.js` e troque pela URL real do seu app no Render:

```js
window.SERVER_URL = "https://SEU-APP.onrender.com";
```

(É a mesma URL que aparece no painel do Render, algo tipo
`https://compartilhar-tela.onrender.com`.)

## 2. Testando localmente (no seu PC, antes de gerar o instalador)

```bash
cd desktop-app
npm install
npm start
```

Abre a janela do app. Testa compartilhar tela, chat, etc.

## 3. Gerando o `.exe` pra distribuir

**A forma mais fácil — build automática pelo GitHub (recomendado):**

1. Suba a pasta `desktop-app/` (junto com o resto do projeto) pro GitHub.
2. Crie uma tag de versão e envie:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. O GitHub Actions (workflow já incluso em
   `.github/workflows/build.yml`) builda o `.exe` automaticamente numa
   máquina Windows na nuvem — você não precisa ter Windows.
4. Quando terminar (alguns minutos), vai aparecer em **Releases** no seu
   repositório do GitHub, com o `.exe` pronto pra baixar.
5. Manda o link da Release pros seus amigos. Eles baixam e instalam
   normal, como qualquer programa.

Se preferir rodar manualmente (sem tag), vá em **Actions** no GitHub,
escolha o workflow "Build Windows App" e clique em **Run workflow**.

**Build manual (se você tiver um PC Windows):**

```bash
cd desktop-app
npm install
npm run dist
```

O instalador aparece em `desktop-app/dist/*.exe`.

## Como funciona

- O app abre uma janela normal carregando a mesma interface do site
  (`public/index.html`), mas conecta direto na URL do Render definida
  em `config.js`, em vez de "localhost".
- Compartilhamento de tela no Electron precisa de um passo a mais que
  no navegador: `main.js` intercepta o pedido e abre uma janelinha
  (`picker.html`) pra você escolher qual tela/janela compartilhar —
  isso é tratado automaticamente, não precisa mexer em nada.
- Todo o resto (chat, WebRTC entre os participantes, salas) funciona
  igual à versão web.

## Se quiser fazer pra Mac/Linux também

O `package.json` já tem configuração pra `dmg` (Mac) e `AppImage`
(Linux). Adicione outro job no `build.yml` com `runs-on: macos-latest`
ou `ubuntu-latest`, do mesmo jeito que o de Windows, ou rode
`npm run dist` localmente numa máquina desses sistemas.
