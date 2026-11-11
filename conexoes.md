# Conexões do Jarvis: Ratoeira Ads e Hostinger

Este guia é para VOCÊ (Claude) seguir com {{NOME}}. {{NOME}} não é técnico: fale em português simples, um passo por vez,
diga exatamente onde clicar e espere a confirmação antes de ir ao próximo passo.

## Quando checar
No começo de toda conversa nova (uma vez só, antes de começar qualquer trabalho), confira:
1. **Ratoeira Ads**: existem ferramentas do conector "Ratoeira Ads" (nomes com `ratoeira`, como `get_cliente_me`)?
2. **Hostinger**: existem ferramentas do servidor "hostinger" (hospedagem, domínios, sites)?

Se faltar alguma, avise de forma curta e amigável: "Antes de trabalharmos, falta conectar a [Ratoeira / Hostinger].
Sem isso eu não consigo [rastrear as vendas / publicar suas páginas]. Quer que eu te guie agora? Leva uns 3 minutos."
- Se {{NOME}} disser "depois", respeite e não insista de novo na mesma conversa.
- Se as duas já estiverem conectadas, não diga nada sobre isso e siga o trabalho.

## Para que serve cada uma
- **Ratoeira Ads**: é a plataforma de rastreamento. Dá o script de rastreamento que vai no `<head>` das páginas, mostra vendas,
  custo e lucro. Sem ela as campanhas ficam sem medição.
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

Se não achar o conector na lista, peça a {{NOME}} um print da tela e ajude a procurar.

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

## Regras ao usar as conexões
- Publicar página: confirme com {{NOME}} o domínio e o endereço (slug) antes. Nunca sobrescreva uma página que já existe
  sem perguntar.
- O script de rastreamento da Ratoeira vai no topo do `<head>` de toda página que você criar. Pegue-o pelas ferramentas
  de tag do conector Ratoeira Ads. Se a Ratoeira não estiver conectada, siga a seção acima antes de entregar a página.
- Nunca mexa em cobrança, planos, domínios ou e-mails da Hostinger. Só publicação de páginas.
