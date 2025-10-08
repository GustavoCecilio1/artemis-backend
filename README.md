# Ártemis ↔ HRCA – Backend

API em Node/Express para integrar o dashboard com Google Drive e Google Sheets usando uma service account, com
arquitetura em camadas (config → serviços → controladores → rotas) e um dashboard web responsivo servido pelo próprio
backend.

## Pré-requisitos

- Node.js 18+
- Arquivo JSON da service account do Google Cloud (não versionar).
- IDs já definidos no front:
  - `SHEETS_CONTROL_ID = 1icehYQWPUYgCKIIcgBq_Gw6Mp_8h6qTDQi3DYmiaNZo`
  - `DRIVE_ROOT_FOLDER_ID = 1WnhJQZYY6GC-aGiSu5HWTgkBqNg_kpEj`

## Configuração

1. Copie o arquivo JSON baixado do Google Cloud para `google-service-account.json` na raiz do projeto (ou outro caminho à sua escolha).
2. Crie um arquivo `.env` na raiz do projeto com:

   ```env
   PORT=4000
   GOOGLE_APPLICATION_CREDENTIALS=./google-service-account.json
   DRIVE_ROOT_FOLDER_ID=1WnhJQZYY6GC-aGiSu5HWTgkBqNg_kpEj
   SHEETS_CONTROL_ID=1icehYQWPUYgCKIIcgBq_Gw6Mp_8h6qTDQi3DYmiaNZo
   ```

3. Instale as dependências:

   ```bash
   npm install
   ```

4. Rode em desenvolvimento:

   ```bash
   npm run dev
   ```

   A API sobe em `http://localhost:4000`. O dashboard pode ser acessado em `http://localhost:4000/` e consome o endpoint
   `GET /api/dashboard/summary` para exibir os indicadores consolidados.

### Usando variáveis em produção

Em deploys, você pode evitar subir o arquivo `.json` e definir apenas:

- `GOOGLE_SERVICE_ACCOUNT_JSON` contendo o conteúdo completo do JSON.
- (Opcional) `GOOGLE_APPLICATION_CREDENTIALS` apontando para um caminho específico.

O backend cria automaticamente `/tmp/google-service-account.json` quando `GOOGLE_SERVICE_ACCOUNT_JSON` está definido e `GOOGLE_APPLICATION_CREDENTIALS` não foi informado.

## Rotas disponíveis

- `GET /api/health` – teste rápido.
- `GET /api/drive/patients/:patientId/folder?create=true` – busca (ou cria) a pasta do paciente no Drive.
- `POST /api/drive/patients/:patientId/upload` – upload de arquivo (campo `file` multipart/form-data).
- `GET /api/sheets/rows?range=Controle!A:F` – lê linhas da planilha.
- `POST /api/sheets/append` – adiciona linhas (`{ "values": [[...]] }`).
- `POST /api/sheets/update` – atualiza um intervalo específico.
- `POST /api/sheets/clear` – limpa um intervalo da planilha.
- `POST /api/sheets/setup-table` – limpa/atualiza cabeçalhos, congela linha e aplica formatação na aba indicada.
- `GET /api/dashboard/summary` – retorna contadores consolidados (Drive x Planilha), pendências e pastas recentes para o dashboard.

> Garanta que a service account tem acesso de Editor tanto à planilha quanto à pasta/drive compartilhado no Google Drive.

## Produção

- Nunca commite o arquivo `.env` nem o `google-service-account.json`.
- Use Secret Manager/variáveis de ambiente no serviço de hospedagem para armazenar esses dados.
- O dashboard pronto em `http://seu-servidor/` já consome `http://seu-servidor/api/...` e pode ser utilizado como ponto de
  partida ou monitoramento operacional.

### Agendando o sincronizador em serviços cloud

- **Railway / Render / Fly.io**: configure um cron job com o comando `node src/syncDriveToSheet.js`.
  - Dias úteis (seg a sex, a cada hora): `0 * * * 1-5`
  - Finais de semana (sáb/dom às 09h e 18h): `0 9,18 * * 6-7`
- Garanta que as variáveis estão definidas: `DRIVE_ROOT_FOLDER_ID`, `SHEETS_CONTROL_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON` (ou o arquivo equivalente).
- Os logs dos cron jobs ficam disponíveis no painel do provedor, permitindo auditar os sincronismos.
