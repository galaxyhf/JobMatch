# JobMatch

O JobMatch compara um currículo revisado com vagas públicas de empresas. A busca, os filtros, a pontuação de compatibilidade, a análise de vagas e a candidatura assistida funcionam sem cadastro e sem serviços de IA. A interface é em português brasileiro, com temas claro e escuro.

## Executar localmente

Use Node.js 22.13 ou superior e pnpm 10. A versão exata do pnpm está em `package.json`.

```bash
pnpm install
pnpm dev
```

Abra [localhost:3000](http://localhost:3000). A busca precisa de acesso à internet pelos servidores do JobMatch. As configurações padrão já permitem consultar os quadros públicos. Para rodar o build local de produção, use `pnpm build && pnpm start`.

1. Envie um PDF com texto selecionável ou DOCX de até 4 MiB, ou preencha **Meu currículo** manualmente. Revise as informações extraídas e confirme.
2. Explore vagas, use os filtros e abra os detalhes. Também é possível começar a exploração sem currículo.
3. Para um anúncio específico, use **Analisar vaga por link**. Se a API oficial não fornecer a descrição, cole o texto. Outra opção é analisar texto sem URL.
4. Abra a candidatura na página indicada pela fonte. Depois de enviá-la no site da empresa, você pode registrá-la nos detalhes da vaga.

## Fontes reais

| Fonte | Catálogo inicial | Acesso |
| --- | --- | --- |
| Greenhouse | Grupo QuintoAndar, EBANX e VTEX | GET público por identificador do quadro |
| Lever | CI&T e Binance | GET público por identificador do quadro, com parâmetros de paginação |
| Ashby | Linear, Supabase e Webflow | GET público por identificador do quadro, incluindo remuneração quando publicada |
| LinkedIn | Primeira página da pesquisa pública | Extração do HTML no servidor |

Esses quadros cobrem vagas no Brasil e no exterior. A disponibilidade, as modalidades e as condições de contratação mudam conforme os anúncios. O catálogo de quadros é configurável. Para um link no domínio oficial de Greenhouse, Lever ou Ashby, o JobMatch também tenta resolver quadros fora do catálogo. Links de outros portais, inclusive Indeed e Gupy, podem ser usados junto ao texto colado pelo usuário.

**LinkedIn.** As vagas públicas aparecem na lista principal, identificadas pela fonte, e podem ser selecionadas no filtro **Fonte**. O servidor consulta a primeira página da listagem pública com os termos e filtros aplicáveis. A descrição é carregada ao abrir os detalhes. Os filtros e a pontuação usam os campos disponíveis. Em caso de falha, a busca continua com as demais fontes. Os [termos do LinkedIn Jobs](https://www.linkedin.com/legal/jobs-terms-conditions) exigem autorização escrita para a coleta automatizada.

### Configurar ou adicionar um quadro

Copie `.env.example` para `.env.local` e defina `JOB_BOARDS` como uma lista JSON com até 16 objetos. Cada objeto inclui `source`, `slug` e `company`. Em quadros do Lever hospedados na Europa, defina `region` como `eu`. O valor padrão de `region` é `global`. A variável substitui o catálogo inteiro. Se o JSON estiver ausente ou inválido, o aplicativo usa o catálogo inicial.

Confirme o identificador em um quadro público da empresa e valide o GET oficial antes de adicioná-lo. Consulte [Greenhouse Job Board API](https://docs.greenhouse.io/job-board), [Lever Postings API](https://github.com/lever/postings-api) e [Ashby Public Job Posting API](https://developers.ashbyhq.com/docs/public-job-posting-api).

### Adicionar uma integração

1. Inclua a fonte no schema, no catálogo de quadros e no mapa de nomes da interface.
2. Em `src/lib/jobs/providers.ts`, configure URLs fixas da API oficial e declare a validação da resposta. Inclua apenas domínios autorizados na lista de hosts e implemente identificação de links onde o formato for documentado.
3. Em `src/lib/jobs/normalize.ts`, mapear os dados para `Job` exige evidência nos campos estruturados ou no anúncio. Preserve o link de candidatura original e converta HTML em texto. Adicione casos de teste para o mapeamento e para a falha da fonte.

O conector Greenhouse consulta conteúdo no catálogo e tenta complementar a remuneração nos detalhes. `updated_at` indica atualização, por isso fica fora da ordenação por publicação. O conector Lever consulta até 600 anúncios por quadro, em lotes de 100. A data de criação interna do Lever não é usada como publicação. As vagas Ashby sinalizadas como não listadas ficam fora do catálogo e podem ser consultadas por um link direto. Descrições extensas são limitadas a 60 mil caracteres. Quando fontes ou campos estiverem indisponíveis, a interface indica a falha ou a ausência de informação.

O serviço limita downloads externos a 8 MiB por resposta das APIs e 1 MiB por resposta do LinkedIn e aplica timeout de 6,5 s por GET. Há quatro chamadas externas simultâneas por processo, deduplicação de buscas concorrentes, espera em caso de 429 seguindo `Retry-After` com limites e cache em memória de cinco minutos. Se um quadro falhar, os últimos dados podem ser usados por até 30 minutos com indicação na interface. O catálogo segue em páginas de até aproximadamente 2,5 MB, e a lista exibe dez resultados por vez. Duplicatas usam o ID da fonte, as URLs canônicas e a descrição normalizada junto a cargo, empresa e localização.

## Filtros e compatibilidade

- **Cargo, palavras-chave e tecnologias** aceitam termos normalizados, incluindo acentos, sinônimos como JS e JavaScript e alguns termos de cargo em português e inglês. Tecnologias separadas por vírgula são combinadas com **E**.
- **Países, modalidades, senioridades e fontes** aceitam múltipla seleção com **OU** dentro de cada grupo. Os demais filtros combinam com **E**. Cidade e empresa aceitam parte do nome. Idiomas representam menções identificadas nos requisitos.
- **Remoto** indica modalidade. A elegibilidade geográfica é avaliada separadamente usando localizações e restrições explícitas. Para o filtro Brasil, vagas remotas sem evidência geográfica ficam de fora. A descrição original é a referência para as condições de contratação.
- **Remuneração** usa valores publicados com moeda. O filtro de salário mínimo compara o piso anunciado no período selecionado. Para ordenar, os períodos conhecidos são convertidos para uma escala anual com fatores aproximados de 12 meses, 52 semanas, 260 dias ou 2.080 horas. Moedas ficam em grupos separados, sem conversão cambial. Remuneração de período indefinido aparece nos detalhes e fica fora da ordenação salarial.
- **Tempo de publicação** filtra pelas últimas 24 horas, 7 dias ou 30 dias. Com um período ativo, só entram no catálogo vagas com data de publicação conhecida.
- **Compatibilidade mínima** exige currículo confirmado e evidência suficiente para pontuar a vaga. É possível limpar os filtros e escolher se as preferências devem ser lembradas pelo navegador.

A pontuação determinística de 0 a 100 é estimada em `src/lib/matching.ts`, com pesos configuráveis em `matchWeights`. Ela combina habilidades (26), cargo (17), senioridade (8), experiência (9), formação (7), idiomas (8), localização (7), modalidade (5), requisitos obrigatórios (18) e desejáveis (5). O cálculo normaliza pelo total dos pesos aplicáveis, penaliza requisitos avaliáveis sem evidência e considera restrição geográfica quando há dados para a comparação. Anos aproximados vêm de períodos informados ou de uma menção no resumo, e não comprovam tempo de experiência em uma tecnologia específica. O resultado estima aderência textual e a tela explica os critérios utilizados. Os campos revisados são a referência da comparação.

## Arquitetura e privacidade

- `src/app` tem páginas do Next.js App Router e Route Handlers. `src/components` tem a interface React, componentes shadcn/ui, estado da sessão, React Hook Form e TanStack Query. `src/lib` contém validação Zod, extração, normalização, filtros e compatibilidade.
- `POST /api/resume/parse` recebe um único arquivo por multipart. As assinaturas de PDF e ZIP são verificadas. O processamento aceita até 40 páginas de PDF, 2.048 entradas e 16 MiB descomprimidos no DOCX, e até 160 mil caracteres extraídos. Arquivos corrompidos, protegidos e PDFs sem texto selecionável recebem mensagens específicas para a ação possível. O leitor opera em memória e não usa OCR.
- Um currículo revisado permanece na memória da aba enquanto o usuário navega. Recarga completa ou fechamento da aba encerra a sessão. O arquivo não é gravado em disco pelo aplicativo. Dados do currículo não são consultados pelos provedores de vagas e a pontuação é calculada no navegador. O aplicativo não registra conteúdo pessoal em logs.
- `GET /api/jobs/search` retorna o catálogo público e o estado dos quadros. Aceita `source` repetido, termos e filtros para a consulta ao LinkedIn e usa `after` junto de `snapshot` para a página seguinte. `GET /api/jobs/[id]` consulta um anúncio público do catálogo. `POST /api/jobs/analyze` recebe link e/ou descrição. O servidor constrói URLs de provedores conhecidos. Para detalhes do LinkedIn, aceita um redirecionamento para a página pública do mesmo identificador em um domínio do LinkedIn. Textos externos são exibidos como texto, sem interpolação de HTML.
- A candidatura abre o link em outra aba com `noopener noreferrer`. O registro local é manual e guarda apenas o identificador. Preferências são persistidas por opção do usuário, e podem ser apagadas ao desmarcá-la. O tema escolhido usa armazenamento local.
- Os limites de requisição por IP e por rota, o cache e o limite de concorrência são por processo. Em serverless, instâncias diferentes têm contadores e caches próprios, que são descartados ao reiniciar. Em publicação de alto tráfego, o controle global deve ser feito na camada de hospedagem.

## Geração futura com IA

A página de personalização mostra a vaga, os requisitos, o currículo confirmado e as opções de idioma, formato e estilo. O botão fica desabilitado e `POST /api/resume/generate` responde com HTTP 501 e código `AI_NOT_CONFIGURED` quando recebe um pedido válido. Nenhum provedor de IA é carregado.

A interface `ResumeGenerator` de `src/lib/resume/generate.ts` recebe um `ResumeGenerationRequest` validado por Zod, com currículo, vaga, idioma (`pt-BR`, `en`, `es`), formato (`pdf`, `docx`) e modelo. Para ativar a geração, configure o provedor no servidor, informe ao usuário quais dados serão enviados, conecte o provedor ao endpoint e habilite o formulário. A integração deve usar apenas os dados confirmados e manter experiências, competências e certificações fiéis ao currículo.

## Testes e build

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
pnpm build
```

As fixtures locais são usadas exclusivamente pelos testes. Os testes de navegador cobrem upload, revisão, busca, detalhes, abertura da candidatura, análise por texto, preferências móveis e interface de personalização. Defina `JOBMATCH_TEST_LIVE=1` para também executar o teste que consulta fontes reais. `JOBMATCH_TEST_URL` permite testá-lo contra um servidor já iniciado, inclusive o build de produção.

## Deploy na Vercel

Importe o repositório como um projeto Next.js, selecione Node.js 24 LTS e mantenha os comandos de instalação e de build detectados pelo framework. O catálogo inicial funciona sem variáveis. Se desejar personalizá-lo, configure `JOB_BOARDS` nos ambientes apropriados.

O upload fica abaixo do limite padrão de 4,5 MB da função, incluindo a sobrecarga multipart. O parser roda no runtime Node.js. Os Route Handlers têm duração máxima declarada na aplicação para upload, catálogo e consulta individual. Confira [Vercel Functions Limits](https://vercel.com/docs/functions/limitations) e [Package Managers](https://vercel.com/docs/package-managers).
