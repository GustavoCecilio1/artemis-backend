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
   DASHBOARD_ADMIN_PASSWORD=admin123
   DASHBOARD_OPERATIONS_PASSWORD=operacoes123
   DASHBOARD_REVIEWER_PASSWORD=revisor123
   DASHBOARD_DOCTOR_PASSWORD=medico123
   DASHBOARD_HRCA_PASSWORD=hrca123
   AUTH_SESSION_TTL=14400000
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

   > **Importante:** altere as senhas padrão (`DASHBOARD_*_PASSWORD`) em produção. Também é possível definir todos os usuários via
   > `DASHBOARD_USERS` contendo um array JSON de objetos `{ "username", "password", "role", "displayName" }`.

### Autenticação e perfis

- O acesso ao dashboard agora exige login. Os perfis disponíveis são **Admin**, **Operações**, **Revisor**, **Médico** e **HRCA**.
- Apenas o perfil **Admin** consegue alternar entre todas as visões; os demais perfis visualizam apenas sua própria visão e ações
  associadas.
- Os tokens de sessão possuem duração configurável via `AUTH_SESSION_TTL` (padrão: 4h) e são mantidos apenas em memória.

### Inspirações de CRM para evoluir o dashboard

Para aproximar a experiência de uso de CRMs como o ClickUp e ampliar a integração entre Drive, Planilha e times, considere:

- **Boards e timelines visuais:** oferecer alternativas de visualização Kanban/Calendário para acompanhar tarefas por fase, prazo e
  responsável, sincronizando status diretamente com a planilha de controle.
- **Automação de fluxos:** permitir regras configuráveis (ex.: mover para "Em análise" ao anexar novo laudo no Drive, alertar o time
  de Operações quando um caso está a 12h do SLA) e registrar as ações executadas na planilha.
- **Comentários colaborativos:** adicionar feed de comentários/notas por caso com menções e upload rápido para o Drive, centralizando
  histórico de comunicação e reduzindo dependência de canais externos.
- **Templates e checklists:** expor modelos de tarefas e checklists específicos por papel (Operações, Revisor, Médico) e salvar o
  progresso no Sheets para padronizar entregas.
- **Painel de notificações e prioridade:** consolidar alertas de SLA, solicitações de redistribuição, assinaturas pendentes e
  protocolos gerados em uma única central, com links diretos para os arquivos no Drive.
- **Integrações bidirecionais:** oferecer webhooks/exports automáticos para alimentar ferramentas de BI ou importar status de outros
  sistemas, mantendo Drive e Planilha como fontes únicas de verdade.

### Usando variáveis em produção

Em deploys, você pode evitar subir o arquivo `.json` e definir apenas:

- `GOOGLE_SERVICE_ACCOUNT_JSON` contendo o conteúdo completo do JSON.
- (Opcional) `GOOGLE_APPLICATION_CREDENTIALS` apontando para um caminho específico.

O backend cria automaticamente `/tmp/google-service-account.json` quando `GOOGLE_SERVICE_ACCOUNT_JSON` está definido e `GOOGLE_APPLICATION_CREDENTIALS` não foi informado.

## Rotas disponíveis

- `POST /api/auth/login` – autenticação por usuário/senha (retorna token e perfil).
- `GET /api/auth/session` – valida a sessão atual (header `Authorization: Bearer <token>`).
- `POST /api/auth/logout` – encerra a sessão atual.
- `GET /api/health` – teste rápido.
- `GET /api/drive/patients/:patientId/folder?create=true` – busca (ou cria) a pasta do paciente no Drive.
- `POST /api/drive/patients/:patientId/upload` – upload de arquivo (campo `file` multipart/form-data).
- `GET /api/sheets/rows?range=Controle!A:F` – lê linhas da planilha.
- `POST /api/sheets/append` – adiciona linhas (`{ "values": [[...]] }`).
- `POST /api/sheets/update` – atualiza um intervalo específico.
- `POST /api/sheets/clear` – limpa um intervalo da planilha.
- `POST /api/sheets/setup-table` – limpa/atualiza cabeçalhos, congela linha e aplica formatação na aba indicada.
- `GET /api/dashboard/summary` – retorna contadores consolidados (Drive x Planilha), pendências e visões filtradas pelo perfil.

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
