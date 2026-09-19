# 🕒 CSApp - Streamer Hub (Subathon & Overlays)

> **A central local de controlo e overlays interativos para transmissões na Twitch.**
> Temporizador dinâmico de Subathon, Fila de Objetivos animada, Pódio de Apoiantes, Roleta de Desafios, sincronização automática com Google Sheets e um Editor Visual de Overlays no browser.

---

## ✨ Principais Funcionalidades

### ⏱️ 1. Subathon Timer em Tempo Real
- **Cálculo Automático de Tempo:** Adiciona tempo instantaneamente para eventos da Twitch e StreamElements:
  - Subs Normais e Gift Subs (com suporte configurável para Tiers 1, 2 e 3).
  - *Debounce* de Sub Bombs (agrupa dezenas de gifts num único evento claro).
  - Bits / Cheers.
  - Doações em dinheiro (Tips) e Ko-fi.
  - Follows e Raids (com tempo base e tempo por espectador).
- **Controlos de Emergência:** Pausar/Retomar relógio, adicionar ou subtrair tempo manual e repor valores.

### 🎯 2. Fila de Objetivos Animada (Goals Queue)
- Acompanhamento automático de progresso de metas por número de subs ou por valor monetário.
- **Animações Fluidas no OBS:** Objetivos concluídos esperam o tempo configurado, fazem *fade-out* e os próximos sobem suavemente (*slide-up*).
- Gestão em tempo real no Dashboard: Adicionar, editar, reordenar (Drag & Drop) e remover objetivos sem reiniciar nada.

### 🏆 3. Pódio de Top Apoiantes (Podium Widget)
- Alternância automática e animada a cada 10 segundos entre:
  - 🥇 **Top Subs**
  - 💎 **Top Bits**
  - 💸 **Top Donos / Tips**
- Orientação Horizontal ou Vertical para encaixar em qualquer layout de OBS.
- Unificação inteligente de apoiantes (*case-insensitive*) para evitar perfis duplicados.

### 🎡 4. Roleta Interativa (Custom Wheel)
- Sistema completo de Roleta personalizável com física e aceleração em HTML5 Canvas.
- Criação de perfis independentes (ex: *Desafios*, *Castigos*, *Sub Goals*).
- Pesos e probabilidades configuráveis por opção.
- Pop-up com anúncio do vencedor e opção para desativar a opção sorteada.

### 🎨 5. Editor de Design Visual (Estilo Figma no Browser)
- Constrói o visual do teu overlay diretamente na página web com Drag & Drop e redimensionamento interativo.
- Suporte para imagens locais, textos personalizados com fontes customizadas (`.ttf`, `.otf`), cores, sombras (*glow*) e bordas.
- **Ferramenta de Recorte (Crop):** Corta imagens e personaliza o fundo da Fila de Objetivos de forma não-destrutiva.

### 📊 6. Sincronização com Google Sheets
- Registo automático de cada evento numa folha de cálculo com colunas dedicadas (`Subs T1`, `Subs T2`, `Subs T3`, `Gift Subs T1..T3`, `Bits`, `Ko-Fi`, `Tips`, `Follow`, `Raids`).
- Separação diária automática de blocos e gravação de data e hora (`DD-MM-YYYY HH:mm`).
- Botão **Sync Sheets** no Pódio para carregar e recalcular os totais históricos a partir do Google Sheets.

### 🌐 7. Painel de Moderadores & Dual Tunnel
- **Túnel Cloudflare:** Acesso remoto seguro ao painel de moderadores (`/mod.html`) protegido por palavra-passe, permitindo aos teus mods gerir o timer e os objetivos sem terem acesso ao teu computador.
- **Túnel Ko-fi:** Webhook dedicado via localtunnel para integração estável de doações.

---

## 🚀 Como Executar

### Pré-requisitos
- **Windows 10/11 (64-bit)**
- **Node.js 18+** *(apenas se quiseres correr a partir do código-fonte)*

### Opção A: Executável Pronto (Recomendado)
1. Faz o download do instalador ou da versão compilada (`CSApp_Server.exe`).
2. Executa o ficheiro **`Iniciar-CSApp.bat`**.
3. O teu browser abrirá automaticamente o Dashboard em `http://localhost:3000`.

### Opção B: A partir do Código-Fonte (Desenvolvimento)
```bash
# 1. Instalar as dependências
npm install

# 2. Configurar o ficheiro de dados
cp data.example.json data.json

# 3. Iniciar o servidor
node server.js
```

---

## 🖥️ Overlays no OBS Studio

Para adicionar qualquer widget ao OBS Studio, cria uma fonte de **Navegador (Browser Source)** com resolução **1920x1080** (ou personalizada) e o seguinte URL:

| Widget | URL no OBS |
| :--- | :--- |
| **Temporizador** | `http://localhost:3000/overlay/timer` |
| **Fila de Objetivos** | `http://localhost:3000/overlay/goals` |
| **Pódio** | `http://localhost:3000/overlay/podium` |
| **Roleta** | `http://localhost:3000/overlay/roulette` |

---

## 🛠️ Tecnologias Utilizadas

- **Backend:** [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/)
- **Tempo Real:** [Socket.IO](https://socket.io/)
- **Túneis Remotos:** [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) & [localtunnel](https://github.com/localtunnel/localtunnel)
- **Frontend:** Vanilla JavaScript, HTML5 Canvas, CSS moderno
- **Drag & Drop / Resize:** [Interact.js](https://interactjs.io/)
- **Instalador:** [Inno Setup 7](https://jrsoftware.org/isinfo.php)
- **Compilação Executável:** [pkg](https://github.com/vercel/pkg)

---

## 📄 Licença

Este projeto é disponibilizado para uso pessoal e comunitário. Para distribuição comercial ou integração em serviços pagos, contacta o autor.
