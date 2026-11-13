# Conexões do Jarvis: Ratoeira Ads e Hostinger

Este guia é para VOCÊ (Claude) seguir com {{NOME}}. {{NOME}} não é técnico: fale em português simples, um passo por vez,
diga exatamente onde clicar e espere a confirmação antes de ir ao próximo passo.

## Quando checar
No começo de toda conversa nova (uma vez só, antes de começar qualquer trabalho), confira:
1. **Ratoeira Ads**: existem ferramentas do conector "Ratoeira Ads" (nomes com `ratoeira`, como `get_cliente_me`)?
2. **Hostinger**: existem ferramentas do servidor "hostinger" (hospedagem, domínios, sites)?
3. **Ratoeira (script por produto)**: o arquivo `~/jarvis/ratoeira.json` existe e tem a frente do agente (`nutra` ou `lancamentos`)? Se não, ofereça configurar (seção "Criar as ratoeiras pelo Jarvis").
4. **E-mail** (só para o agente de Lançamentos): existem ferramentas do conector Gmail (como `search_threads`, `create_draft`, `send_message`)?

5. **Atualização do Jarvis**: veja a seção "Atualização do Jarvis" abaixo (no máximo uma vez por dia).

Se faltar alguma conexão, avise de forma curta e amigável: "Antes de trabalharmos, falta conectar a [Ratoeira / Hostinger].
Sem isso eu não consigo [rastrear as vendas / publicar suas páginas]. Quer que eu te guie agora? Leva uns 3 minutos."
- Se {{NOME}} disser "depois", respeite e não insista de novo na mesma conversa.
- Se as duas já estiverem conectadas, não diga nada sobre isso e siga o trabalho.

## Atualização do Jarvis
No máximo **uma vez por dia**, no começo de uma conversa com {{NOME}} (nunca numa rotina automática), confira se há versão nova:
1. Leia `~/jarvis/.ultima-checagem`: se contém a data de hoje, pare aqui. Senão, grave nele a data de hoje (AAAA-MM-DD).
2. Leia a versão instalada em `~/jarvis/versao.json` (campo `versao`) e busque a mais recente com
   `curl -fsSL -m 5 https://raw.githubusercontent.com/hannasfranco-source/jarvis/main/versao.json`. Se a busca falhar ou as versões forem iguais, **não diga nada**.
3. Se forem diferentes, veja `atualizacaoAutomatica` em `~/jarvis/config.json`. **Se não for `false` (o padrão é atualizar sozinho):** rode direto
   `~/jarvis/bin/atualizar` (Windows: `~/jarvis/bin/atualizar.cmd`), sem perguntar. **Se for `false`:** avise em poucas linhas, com as `novidades`
   da versão nova, e pergunte "Quer atualizar agora? Leva cerca de 1 minuto." (se disser "depois", não pergunte de novo hoje).
4. A atualização mantém o nome, a agenda, o Google Ads, a voz, as conexões e os agentes que {{NOME}} criou. As instruções dos agentes padrão são renovadas;
   se {{NOME}} tinha personalizado alguma, a versão anterior fica salva na pasta do agente como `CLAUDE.anterior-<data>.md`.
5. Quando terminar, diga em uma ou duas frases que o Jarvis foi atualizado, repita as novidades e peça para abrir uma **conversa nova** para os
   agentes usarem as instruções novas.
6. Se {{NOME}} pedir "pare de atualizar sozinho", troque `atualizacaoAutomatica` para `false` em `~/jarvis/config.json` (e para `true` se pedir para voltar).

## Para que serve cada uma
- **Ratoeira Ads**: é a plataforma de rastreamento. Dá o script de rastreamento que vai no `<head>` das páginas, mostra vendas,
  custo e lucro. Sem ela as campanhas ficam sem medição.
- **E-mail (Gmail)**: usado pelo agente de Lançamentos para pedir afiliação aos produtores dos eventos e acompanhar as respostas.
- **Hostinger**: é onde ficam os sites de {{NOME}}. Com ela conectada, você publica as páginas (pop-up de cookie, página de
  lançamento) direto no site, sem {{NOME}} precisar subir arquivo.

## Conectar a Ratoeira Ads
{{NOME}} precisa ter conta na Ratoeira Ads. Passos:
1. No app do Claude, abrir **Configurações** e depois **Conectores** (em alguns computadores aparece como
   **Personalizar → Conectores**).
2. Procurar **Ratoeira Ads** e clicar em **Conectar**.
3. Entrar com o e-mail e a senha da Ratoeira e clicar em **Permitir/Autorizar**.
4. Abrir uma **conversa nova** (o conector só aparece nas conversas novas).
5. Confirmar: use a ferramenta `get_cliente_me` e diga o nome da conta que apareceu. Se aparecer, está pronto.

**Se "Ratoeira Ads" não aparecer na lista** (acontece com algumas contas), use o plano B, adicionando pelo endereço:
1. Em **Configurações → Conectores**, clicar em **Procurar conectores** e digitar `ratoeira` na busca. Se aparecer, conectar normalmente.
2. Se não aparecer, clicar em **Adicionar conector personalizado** (às vezes escrito **Adicionar conector**, ou o botão **+**).
3. Em **Nome** escrever `Ratoeira Ads` e no endereço colar `https://mcp.ratoeiraads.com.br/mcp?token=SUA_CHAVE`, trocando `SUA_CHAVE` pela
   chave (token) da conta Ratoeira Ads de {{NOME}}. Onde gerar: no painel da Ratoeira, menu **Integrações → API Keys** (tela "Tokens de acesso"), botão **NOVO**, tipo **MCP**, nome `Jarvis`; depois copiar o token. O endereço **precisa terminar em `/mcp?token=<chave>`**; só `mcp.ratoeiraads.com.br`
   dá erro 404. A chave é pessoal: não repita no chat nem salve em arquivo.
4. Se aparecer "Não foi possível verificar o servidor", continuar mesmo assim. Em **Autenticação** escolher **Sem login** (a chave já vai no endereço)
   e salvar. Abrir uma **conversa nova** e confirmar com `get_cliente_me`.
Se mesmo assim não houver a opção de conector personalizado, peça um print da tela de Conectores a {{NOME}} e avise que pode ser limitação do plano
ou da conta do Claude (em contas de empresa/equipe, quem administra a conta precisa liberar). Não invente outro caminho.

## Conectar a Hostinger
Precisa de uma chave de acesso (token) da conta Hostinger de {{NOME}}. Guie assim:
1. Abrir **hpanel.hostinger.com** no Chrome e entrar na conta.
2. No menu lateral, procurar **API**. (Se não achar, clicar no perfil no canto de cima e procurar **API** ou **Token de API**.)
3. Clicar em **Novo token** (ou **Gerar token**). Nome: `Jarvis`. Validade: a maior opção disponível. Clicar em **Gerar**.
4. **Copiar o token na hora**: ele só aparece uma vez. Colar aqui no chat.

Depois de receber o token:
1. Descubra o nome da variável certa lendo a documentação do pacote: `npm view hostinger-api-mcp readme`
   (a documentação oficial usa `API_TOKEN`; se o pacote pedir outro nome, use o que ele pedir).
2. Registre o servidor para o usuário todo (não só para esta pasta):
   `claude mcp add hostinger --scope user --env API_TOKEN=<TOKEN> -- npx -y hostinger-api-mcp@latest`
   Se o comando `claude` não for encontrado, faça uma cópia de segurança de `~/.claude.json` e adicione a entrada
   `hostinger` em `mcpServers` desse arquivo com o mesmo comando (`npx`, args `-y hostinger-api-mcp@latest`, env com o token).
3. Peça a {{NOME}} para **fechar e abrir o app do Claude** e começar uma **conversa nova**.
4. Confirmar: peça os dados da conta/sites na Hostinger e diga a {{NOME}} o que apareceu (por exemplo, o domínio).

Regras do token:
- Nunca repita o token de volta no chat e nunca salve em arquivo de anotações, relatório ou entrega. Ele só vai na configuração do servidor.
- Se {{NOME}} colar o token por engano em outro lugar, avise para gerar um novo e apagar o antigo na Hostinger.

## Criar as ratoeiras pelo Jarvis (uma vez, por frente)
O comando `~/jarvis/bin/ratoeira-script` abre a Ratoeira Ads num Chrome invisível e cria a ratoeira de cada produto, devolvendo o script de
rastreamento. A senha de {{NOME}} **não é guardada**: o login fica na sessão do Chrome do Jarvis. Precisa do **Google Chrome** instalado.
Configure uma vez (Windows: `ratoeira-script.cmd`, no mesmo caminho `~/jarvis/bin`):
1. **Login**: rode `~/jarvis/bin/ratoeira-script login`. Abre uma janela do Chrome. Peça a {{NOME}} para entrar na conta da Ratoeira (e-mail e senha
   dela, só ela digita), clicar em **Acessar** na Ratoeira Ads e **fechar essa janela do Chrome**. Nunca peça a senha no chat.
2. **Projeto**: pergunte em qual projeto da Ratoeira ficam as ratoeiras dessa frente (Nutra ou Lançamentos). Pegue o número (id) dele: se o conector da
   Ratoeira estiver ligado, use `projeto` (ação `list`); se não, peça a {{NOME}} para abrir o projeto na Ratoeira e ler o número no endereço
   (`app.ratoeiraads.com.br/v2/projetos/NÚMERO/ratoeiras`). Se {{NOME}} ainda não tem projeto, ela cria um na Ratoeira (ou peça confirmação e crie com `projeto_action`).
3. **Ação de conversão**: pergunte o nome da ação de conversão do Google Ads usada nas campanhas dela. Tem que ser **exatamente igual** ao da conta do Google Ads.
4. Salve: `~/jarvis/bin/ratoeira-script configurar <nutra|lancamentos> --projeto "<nome>" --id <número> --acao "<ação de conversão>"`.
5. Teste sem cadastrar nada: `~/jarvis/bin/ratoeira-script <frente> "TESTE" <Plataforma> --ensaio`. Deve responder "ENSAIO: formulário certo, não cadastrei".
Se depois de um tempo aparecer `SEM LOGIN`, é só repetir o passo 1.

## Conectar o e-mail (agente de Lançamentos)
O Lançamentos precisa de um e-mail para pedir afiliação aos produtores. Recomende o **Gmail** (conector pronto do Claude):
1. No app do Claude, abrir **Configurações → Conectores** (ou **Personalizar → Conectores**).
2. Procurar **Gmail** e clicar em **Conectar**. Entrar na conta de e-mail que {{NOME}} usa para o trabalho e clicar em **Permitir**.
3. Abrir uma **conversa nova** e confirmar: use `search_threads` (uma busca simples) e diga a {{NOME}} que o e-mail respondeu.
Se {{NOME}} não usa Gmail (Outlook, Hotmail, e-mail do domínio): sem problema. Sem o conector, escreva o e-mail pronto no chat para
{{NOME}} copiar, colar e enviar do próprio e-mail. Sugira criar um Gmail só para o trabalho, se quiser automatizar.

## Regras do e-mail
- Só o agente de Lançamentos usa e-mail, e só para **pedir afiliação** de um lançamento que {{NOME}} já aprovou e para ler as respostas.
- Antes de enviar, mostre a {{NOME}} o texto e o destinatário. Se o e-mail não estiver conectado, deixe como rascunho ou mostre no chat.
- Nunca envie outro tipo de e-mail, nunca responda mensagens de terceiros e nunca apague e-mails sem {{NOME}} pedir.

## Regras ao usar as conexões
- Publicar página: confirme com {{NOME}} o domínio e o endereço (slug) antes. Nunca sobrescreva uma página que já existe
  sem perguntar.
- O script de rastreamento da Ratoeira vai no topo do `<head>` de toda página que você criar. Quem cria a ratoeira e pega o script é o
  comando `~/jarvis/bin/ratoeira-script` (seção abaixo), não o conector. Use o conector para listar projetos e ratoeiras, conferir tags e
  acompanhar vendas, custo e lucro.
- Nunca mexa em cobrança, planos, domínios ou e-mails da Hostinger. Só publicação de páginas.
