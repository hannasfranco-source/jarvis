// Atualização do Jarvis: mantém os agentes que o aluno criou e atualiza os agentes padrão.
//   node mesclar-equipe.mjs <equipe.json novo> <equipe.json do aluno>
import fs from 'node:fs';
const [novoArq, atualArq] = process.argv.slice(2);
const novo = JSON.parse(fs.readFileSync(novoArq, 'utf8'));
const atual = JSON.parse(fs.readFileSync(atualArq, 'utf8'));
const padrao = new Set(novo.agentes.map((a) => a.id));
const extras = (atual.agentes || []).filter((a) => !padrao.has(a.id));
atual.agentes = [...novo.agentes, ...extras];
atual.pastaBase = atual.pastaBase || novo.pastaBase;
fs.writeFileSync(atualArq, JSON.stringify(atual, null, 2) + '\n');
console.log(`equipe: ${novo.agentes.length} padrão + ${extras.length} do aluno`);
