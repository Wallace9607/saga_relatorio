 // Utilitários de tempo
  const toSec = t => { const [h,m,s]=t.split(':').map(Number); return (h||0)*3600+(m||0)*60+(s||0); };
  const toHHMMSS = sec => {
    if(!isFinite(sec)) return '—';
    const h=String(Math.floor(sec/3600)).padStart(2,'0');
    const m=String(Math.floor((sec%3600)/60)).padStart(2,'0');
    const s=String(Math.floor(sec%60)).padStart(2,'0');
    return `${h}:${m}:${s}`;
  };

  // Meta (período + data)
  const hoje = new Date();
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  document.getElementById('periodo').textContent =
    meses[hoje.getMonth()].charAt(0).toUpperCase()+meses[hoje.getMonth()].slice(1) + ' de ' + hoje.getFullYear();
  document.getElementById('emissao').textContent = hoje.toLocaleDateString('pt-BR');

  // Aguardador: só coleta quando todos iframes carregarem
  const frames = ['if-att','if-tm','if-senhas','if-tme-serv','if-tma-serv','if-saga','if-medias','if-senhas-mes'];
  let loaded = 0;
  frames.forEach(id=>{
    document.getElementById(id).addEventListener('load',()=>{
      loaded++;
      if(loaded===frames.length){ coletarDados(); }
    });
  });

function gerarPDF() {
  const element = document.getElementById("print");
  const opt = {
    margin: [10,10,10,10],
    filename: "relatorio.pdf",
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["avoid-all", "css", "legacy"] }
  };
  html2pdf().set(opt).from(element).save();
}
document.getElementById("btn-pdf").addEventListener("click", gerarPDF);

  function coletarDados(){
    try{
      // 1) Total por atendente (servicos-atendente.html)
      const docAtt = document.getElementById('if-att').contentDocument;
      const rowsAtt = [...docAtt.querySelectorAll('#atendentes-table tbody tr')];
      let totalGeral = 0;
      const pessoas = [];
      rowsAtt.forEach((tr,i)=>{
        const tds = tr.querySelectorAll('td,th');
        if(tds.length===2 && i < rowsAtt.length-1){
          const nome = tds[0].textContent.trim();
          const val = parseInt((tds[1].textContent||'').replace(/\D+/g,''))||0;
          pessoas.push({nome, val});
          totalGeral += val;
        }

      });
      document.getElementById('kpi-total-atend').textContent = totalGeral || '—';

      // Ranking
      pessoas.sort((a,b)=>b.val-a.val);
      const tbodyRank = document.querySelector('#tbl-ranking tbody');
      tbodyRank.innerHTML = '';
      pessoas.forEach((p,idx)=>{
        const pct = totalGeral? ((p.val/totalGeral)*100).toFixed(1)+'%':'—';
        tbodyRank.insertAdjacentHTML('beforeend',
          `<tr><td>${idx+1}</td><td style="text-align:left">${p.nome}</td><td>${p.val}</td><td>${pct}</td></tr>`);
      });
      document.getElementById('rank-total').textContent = totalGeral || '—';

      // 2) TME/TMA gerais (tempo-medio.html)
      const docTM = document.getElementById('if-tm').contentDocument;
      const linhasTM = [...docTM.querySelectorAll('#indicadores-tempo-table tbody tr')];
      const mapaTM = {};
      linhasTM.forEach(tr=>{
        const [ind, val] = [...tr.querySelectorAll('td')].map(td=>td.textContent.trim());
        mapaTM[ind?.toLowerCase()] = val;
      });
      document.getElementById('kpi-tme').textContent = mapaTM['tme (tempo médio de espera)'] || '—';
      document.getElementById('kpi-tma').textContent = mapaTM['atendimento'] || '—';

      // 3) Senhas: agendadas x balcão (senhas-emitidas.html)
      const docSen = document.getElementById('if-senhas').contentDocument;
      const secs = [...docSen.querySelectorAll('section')];
      let agend = '—', balc = '—';
      if(secs[0]){ const c = secs[0].querySelector('tbody td[contenteditable]'); if(c) agend = c.textContent.trim() || '—'; }
      if(secs[1]){ const c = secs[1].querySelector('tbody td[contenteditable]'); if(c) balc = c.textContent.trim() || '—'; }
      document.getElementById('kpi-agendadas').textContent = agend;
      document.getElementById('kpi-balcao').textContent = balc;

      // 4) TME por serviço
const docTME = document.getElementById('if-tme-serv').contentDocument;
const linhasTME = [...docTME.querySelectorAll('#tme-servico-table tbody tr')];
const mapaTME = {};
linhasTME.forEach(tr=>{
  const tds = tr.querySelectorAll('td');
  if(tds.length===2){
    const serv = tds[0].textContent.trim();
    const val = tds[1].textContent.trim();
    if(/^\d{2}:\d{2}:\d{2}$/.test(val)) mapaTME[serv] = val;
  }
});

// 5) TMA por serviço
const docTMA = document.getElementById('if-tma-serv').contentDocument;
const linhasTMA = [...docTMA.querySelectorAll('#tempo-medio-servico-table tbody tr')];
const mapaTMA = {};
linhasTMA.forEach(tr=>{
  const tds = tr.querySelectorAll('td');
  if(tds.length===2){
    const serv = tds[0].textContent.trim();
    const val = tds[1].textContent.trim();
    if(/^\d{2}:\d{2}:\d{2}$/.test(val)) mapaTMA[serv] = val;
  }
});

// --- Montar tabela de serviços críticos (maior TME)
const paresTME = Object.entries(mapaTME)
  .map(([serv, val]) => ({ serv, sec: toSec(val), val }))
  .sort((a,b)=>b.sec-a.sec);

const tbCrit = document.querySelector('#tbl-criticos tbody');
tbCrit.innerHTML = '';
paresTME.forEach(p=>{ // <<< sem slice
  tbCrit.insertAdjacentHTML('beforeend', 
    `<tr>
       <td style="text-align:left">${p.serv}</td>
       <td>${p.val}</td>
       <td>${mapaTMA[p.serv] || '—'}</td>
     </tr>`);
});

// --- Montar tabela AAO (menor TMA)
const paresTMA = Object.entries(mapaTMA)
  .filter(([serv]) => /^AO\s/i.test(serv)) // pega só AAO
  .map(([serv, val]) => ({ serv, sec: toSec(val), val }))
  .sort((a,b)=>a.sec-b.sec);

const tbAAO = document.querySelector('#tbl-aao tbody');
tbAAO.innerHTML = '';
paresTMA.forEach(p=>{ // <<< sem slice
  tbAAO.insertAdjacentHTML('beforeend', 
    `<tr>
       <td style="text-align:left">${p.serv}</td>
       <td>${mapaTME[p.serv] || '—'}</td>
       <td>${p.val}</td>
     </tr>`);
});


      // 6) SAGA – ocupação = Atendendo / No SAGA
      const docSG = document.getElementById('if-saga').contentDocument;
      const linhasSG = [...docSG.querySelectorAll('#saga-table tbody tr')];
      const corpoSG = document.querySelector('#tbl-saga tbody');
      corpoSG.innerHTML = '';
      let accSess=0, accAtt=0, n=0;
      linhasSG.forEach((tr,i)=>{
        const tds = tr.querySelectorAll('td');
        if(tds.length===5){ // ignora a linha de totais do arquivo-fonte
          const nome = tds[0].textContent.trim();
          const sess = tds[1].textContent.trim();
          const att  = tds[2].textContent.trim();
          const occ = (toSec(sess)>0) ? ((toSec(att)/toSec(sess))*100) : 0;
          corpoSG.insertAdjacentHTML('beforeend',
            `<tr><td style="text-align:left">${nome}</td><td>${sess}</td><td>${att}</td><td>${isFinite(occ)?occ.toFixed(0)+'%':'—'}</td></tr>`);
          accSess += toSec(sess); accAtt += toSec(att); n++;
        }
      });
      document.getElementById('saga-avg-sess').textContent = toHHMMSS(accSess/Math.max(n,1));
      document.getElementById('saga-avg-att').textContent  = toHHMMSS(accAtt/Math.max(n,1));
      document.getElementById('saga-avg-occ').textContent  = (accSess>0)? ((accAtt/accSess)*100).toFixed(0)+'%' : '—';

      // 7) Conclusão automática
const conclSection = document.getElementById('conclusao');

// Primeiro, crie <span> dentro dos parágrafos existentes para atualizar dinamicamente
if(!document.getElementById('span-total-atend')) {
  conclSection.querySelectorAll('p').forEach((p, idx) => {
    p.innerHTML = p.innerHTML.replace(/\[Mês\]/g, `<span id="span-mes"></span>`);
    if(idx === 0) p.innerHTML += ` Total de atendimentos: <span id="span-total-atend"></span>.`;
  });
}

// Atualizar valores dinamicamente
const tmeSec = toSec((document.getElementById('kpi-tme').textContent||'00:00:00'));
const tmaSec = toSec((document.getElementById('kpi-tma').textContent||'00:00:00'));
const fraseTME = tmeSec>0 ? document.getElementById('kpi-tme').textContent : '—';
const fraseTMA = tmaSec>0 ? document.getElementById('kpi-tma').textContent : '—';
const cCrit = document.querySelectorAll('#tbl-criticos tbody tr').length;

document.getElementById('span-total-atend').textContent = totalGeral || '—';
document.getElementById('span-mes').textContent = meses[hoje.getMonth()].charAt(0).toUpperCase() + meses[hoje.getMonth()].slice(1);

// Opcional: adicionar TME/TMA e serviços críticos em um novo <p> sem apagar o conteúdo original
let pResumo = conclSection.querySelector('#resumo-dinamico');
if(!pResumo){
  pResumo = document.createElement('p');
  pResumo.id = 'resumo-dinamico';
  conclSection.appendChild(pResumo);
}
pResumo.textContent =
  `Indicadores: TME = ${fraseTME}, TMA = ${fraseTMA}. Identificados ${cCrit} serviços com maior impacto em espera; ` +
  `ações propostas priorizam triagem e incentivo a canais digitais.`;

if(fraseTME==='—' || fraseTMA==='—'){
  pResumo.textContent += " (Alguns indicadores não foram coletados corretamente.)";
}
    }catch(e){
      alert('Não foi possível coletar todos os dados. Verifique se os arquivos estão na mesma pasta.\n\nDetalhes: '+e.message);
      console.error(e);
    }
  }

  window.addEventListener('load', () => {
  // pegar os dados salvos do iframe
  const dadosSalvos = localStorage.getItem("tabelaServicos");
  if (!dadosSalvos) return;

  const dados = JSON.parse(dadosSalvos);

  dados.forEach(item => {
    // transforma o nome do serviço em id compatível
    let idCampo = "rel-" + item.servico
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
      .toLowerCase()
      .replace(/\s+/g, "-") // espaços por hífen
      .replace(/[^a-z0-9\-]/g, ""); // remove caracteres especiais

    // tenta preencher o campo correspondente
    const campo = document.getElementById(idCampo);
    if (campo) {
      campo.innerText = item.tempo;
    }
  });

  // opcional: calcular a média total no relatório
  let totalSegundos = 0;
  let count = 0;
  dados.forEach(item => {
    const partes = item.tempo.split(':').map(Number);
    if (partes.length === 3) {
      totalSegundos += partes[0]*3600 + partes[1]*60 + partes[2];
      count++;
    }
  });
  const media = count ? Math.floor(totalSegundos / count) : 0;
  const h = String(Math.floor(media/3600)).padStart(2,'0');
  const m = String(Math.floor((media%3600)/60)).padStart(2,'0');
  const s = String(media%60).padStart(2,'0');
  document.getElementById("media-total-relatorio").innerText = `${h}:${m}:${s}`;
});

