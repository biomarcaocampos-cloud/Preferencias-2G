// ============================================================

//  CRIAÇÃO DE PREFERÊNCIAS EM LOTE — eproc TJSP

//  Arquivo: content.js

//  Versão: 3.5.4 (atualizada em 09/11/2026)

// ============================================================



(function () {

  'use strict';



  // Executa SOMENTE na janela principal (ignora iframes)

  if (window !== window.top) return;

  // Trava de isolamento: executa EXCLUSIVAMENTE no eproc 2G

  if (!window.location.hostname.toLowerCase().includes('2g')) return;



  /* ================== CONFIGURAÇÃO & CONTROLE ================== */

  const KEY_STATE = 'eproc_criar_pref_lote_state';

  const KEY_POS = 'eproc_script_panel_pos';



  const loadState = () => { try { return JSON.parse(localStorage.getItem(KEY_STATE)) || null; } catch (e) { return null; } };

  const saveState = (s) => localStorage.setItem(KEY_STATE, JSON.stringify(s));

  const clearState = () => localStorage.removeItem(KEY_STATE);



  let execucaoLoteAtiva = false;

  let gravacaoEmAndamento = false;

  let ultimoAvisoEproc = '';

  window._eprocPararLote = false;



  async function sleep(ms) {

    const fim = Date.now() + ms;

    while (Date.now() < fim) {

      if (window._eprocPararLote) break;

      await new Promise(r => setTimeout(r, Math.min(80, fim - Date.now())));

    }

  }



  function normalizar(txt) {

    if (!txt) return '';

    return String(txt)

      .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu, '')

      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')

      .toLowerCase()

      .replace(/[\s\-_/\\|*()]+/g, ' ')

      .trim();

  }



  // Normalização de localizadores: MANTÉM emojis (⬛🟦 etc. distinguem localizadores homônimos);

  /* ================== CASAMENTO ROBUSTO DE LOCALIZADORES (EMOJI + NOME) ================== */

  function decodeEntities(str) {
    if (!str) return '';
    return String(str)
      .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }

  function toHtmlEntityDecimal(str) {
    if (!str) return '';
    if (typeof window.toHtmlEntityDecimal === 'function') {
      try { return window.toHtmlEntityDecimal(str); } catch (e) {}
    }
    return Array.from(str).map(ch => {
      const cp = ch.codePointAt(0);
      return cp > 127 ? '&#' + cp + ';' : ch;
    }).join('');
  }



  function extractEmojis(str) {

    if (!str) return [];

    const decoded = decodeEntities(str).replace(/\u231B/g, '⏳'); // Unifica ⌛ e ⏳

    const matches = decoded.match(/\p{Extended_Pictographic}/gu) || [];

    return [...new Set(matches.map(e => e.replace(/[\uFE0E\uFE0F]/g, '')))];

  }



  function normalizeCore(str) {

    if (!str) return '';

    return decodeEntities(str)

      .replace(/\p{Extended_Pictographic}/gu, ' ')

      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')

      .toLowerCase()

      .replace(/[^a-z0-9]+/g, ' ')

      .trim();

  }



  function normalizeFull(str) {

    if (!str) return '';

    return decodeEntities(str)

      .replace(/\u231B/g, '⏳')

      .replace(/[\uFE0E\uFE0F\u200B-\u200D]/g, '')

      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')

      .toLowerCase()

      .replace(/[\s\-_–—/\\|*()]+/g, ' ')

      .trim();

  }



  function saoPreferenciasIguais(nomeA, nomeB) {
    if (!nomeA || !nomeB) return false;
    const rawA = decodeEntities(nomeA).trim();
    const rawB = decodeEntities(nomeB).trim();
    if (rawA === rawB) return true;
    if (rawA.toLowerCase() === rawB.toLowerCase()) return true;

    // Comparação compacta preservando emojis (independe de espaços e pontuações)
    const compactar = (s) => decodeEntities(s)
      .replace(/\u231B/g, '⏳')
      .replace(/[\uFE0E\uFE0F\u200B-\u200D]/g, '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[\-_–—/\\|*()]+/g, '');

    const compA = compactar(rawA);
    const compB = compactar(rawB);
    if (compA && compB && compA === compB) return true;

    // Comparação de núcleo textual (sem emojis, acentos e pontuação - preserva números e palavras)
    const coreA = normalizeCore(rawA);
    const coreB = normalizeCore(rawB);
    if (coreA && coreB && coreA.length >= 4 && coreA === coreB) return true;

    return false;
  }





  function extrairPartesOpcao(rawText) {

    const raw = decodeEntities(rawText || '').trim();

    const emojiMatches = Array.from(raw.matchAll(/\p{Extended_Pictographic}/gu));

    let shortPart = raw;

    let longPart = '';



    if (emojiMatches.length >= 2) {

      const lastMatch = emojiMatches[emojiMatches.length - 1];

      const endIdx = lastMatch.index + lastMatch[0].length;

      shortPart = raw.slice(0, endIdx).trim();

      const resto = raw.slice(endIdx).trim();

      if (resto.startsWith('-') || resto.startsWith('–') || resto.startsWith('—')) {

        longPart = resto.replace(/^[\s\-_–—]+/, '').trim();

      }

    } else {

      const lastSep = raw.lastIndexOf(' - ');

      if (lastSep !== -1) {

        shortPart = raw.slice(0, lastSep).trim();

        longPart = raw.slice(lastSep + 3).trim();

      }

    }



    return {

      raw,

      shortPart,

      longPart,

      emojis: extractEmojis(raw),

      full: normalizeFull(raw),

      shortFull: normalizeFull(shortPart),

      core: normalizeCore(raw),

      shortCore: normalizeCore(shortPart)

    };

  }



  function acharOpcaoLocalizador(selectOrOpts, desejado, permitirFallback) {

    if (!selectOrOpts || !desejado) return null;

    const opts = Array.isArray(selectOrOpts) ? selectOrOpts : Array.from(selectOrOpts.options || []);

    if (!opts.length) return null;



    const dRaw = String(desejado).replace(/\s*[\r\n]+\s*/g, ' ').trim();

    const dEmojis = extractEmojis(dRaw);

    const dFull = normalizeFull(dRaw);

    const dCore = normalizeCore(dRaw);

    const compact = s => s.replace(/\s+/g, '');

    const dCompact = compact(dFull);



    const parsedOpts = opts.filter(o => o.value && o.value !== 'null').map(o => {

      const p = extrairPartesOpcao(o.text);

      p.opt = o;

      return p;

    });



    // TIER 1: Match exato preservando emojis (no texto curto ou completo)

    let found = parsedOpts.find(p => p.shortFull === dFull || p.full === dFull);

    if (found) return found.opt;



    // TIER 2: Match exato compacto (sem espaços) preservando emojis

    found = parsedOpts.find(p => compact(p.shortFull) === dCompact || compact(p.full) === dCompact);

    if (found) return found.opt;



    // TIER 3: Prefixo exato com emojis

    found = parsedOpts.find(p => p.full.startsWith(dFull + ' ') || compact(p.full).startsWith(dCompact + '-'));

    if (found) return found.opt;



    // Palavras distintivas fundamentais

    const DISTINCTIVE = ['precatoria', 'mandado', 'ar', 'dje', 'balcao', 'email', 'contestacao', 'edital', 'audiencia', 'triagem', 'bloqueio', 'recurso'];



    // Se o desejado possui emojis, RESTRINGE ESTRITAMENTE a opções que possuem o MESMO emoji!

    // NUNCA escolhe um localizador com emoji diferente (ex: 🟦 em vez de 🦾).

    if (dEmojis.length > 0) {

      const emojiFiltered = parsedOpts.filter(p => p.emojis.some(e => dEmojis.includes(e)));

      if (emojiFiltered.length > 0) {

        // 3a. Texto essencial idêntico no nome curto ou no nome completo

        found = emojiFiltered.find(p => p.shortCore === dCore || p.core === dCore);

        if (found) return found.opt;



        // 3b. Texto essencial começa com o desejado

        found = emojiFiltered.find(p => p.shortCore.startsWith(dCore) || p.core.startsWith(dCore));

        if (found) return found.opt;



        // 3c. O desejado começa com o texto da opção

        found = emojiFiltered.find(p => dCore.startsWith(p.shortCore) || dCore.startsWith(p.core));

        if (found) return found.opt;



        // 3d. Contém o texto essencial completo (ex.: "ag contestacao" em "ag contestacao defesa")

        found = emojiFiltered.find(p => p.core.includes(dCore) || p.shortCore.includes(dCore));

        if (found) return found.opt;



        // 3e. Pontuação por palavras-chave discriminatórias

        const dWords = dCore.split(' ').filter(w => w.length > 1 && !['c', 'p', 'm', 'g', 'd', 'de', 'a', 'o', 'em'].includes(w));

        const requiredDistinctive = DISTINCTIVE.filter(k => dWords.some(w => w === k || (k.length >= 4 && (w.startsWith(k) || k.startsWith(w)))));



        if (dWords.length > 0) {

          let best = null;

          let bestScore = -1;

          for (const p of emojiFiltered) {

            const pWords = p.core.split(' ');



            if (requiredDistinctive.length > 0) {

              const hasRequired = requiredDistinctive.every(k => pWords.some(pw => pw === k || (k.length >= 4 && (pw.startsWith(k) || k.startsWith(pw)))));

              if (!hasRequired) continue;

            }



            let score = 0;

            for (const dw of dWords) {

              if (pWords.includes(dw)) {

                score += (DISTINCTIVE.includes(dw) ? 25 : 10);

              } else if (dw.length >= 4 && pWords.some(pw => pw.startsWith(dw.slice(0, 4)) || dw.startsWith(pw.slice(0, 4)))) {

                score += (DISTINCTIVE.some(k => dw.includes(k)) ? 18 : 6);

              }

            }



            if (score > bestScore) {

              bestScore = score;

              best = p;

            }

          }

          if (best && bestScore >= 6) {

            return best.opt;

          }

        }

      }

      // Se o desejado tem emoji mas nenhuma opção com esse emoji bateu,

      // e o chamador não autorizou fallback genérico sem emoji, retorna null

      if (!permitirFallback) return null;

    }



    // TIER 4: Para buscas sem emoji (ex.: "ARQUIVO - ARQUIVO", "BAIXADOS - BAIXADOS", "SUSPENSOS")

    found = parsedOpts.find(p => p.shortCore === dCore || p.core === dCore);

    if (found) return found.opt;



    found = parsedOpts.find(p => p.core.includes(dCore) || dCore.includes(p.core));

    if (found) return found.opt;



    return null;

  }



  function ehTelaDeMinuta() {
    const params = new URLSearchParams(location.search);
    const acao = (params.get('acao') || '').toLowerCase();
    return acao === 'minuta_cadastrar';
  }

  function ehTelaDeRelatorio() {
    const params = new URLSearchParams(location.search);
    const acao = (params.get('acao') || '').toLowerCase();
    return acao === 'relatorio_geral_listar';
  }

  function ehTelaDeMovimentacao() {
    const params = new URLSearchParams(location.search);
    const acao = (params.get('acao') || '').toLowerCase();
    if (acao === 'processo_movimento_consultar') return true;
    const inpAcao = document.getElementById('acao');
    if (inpAcao && String(inpAcao.value || '').toLowerCase() === 'processo_movimento_consultar') return true;
    return false;
  }

  function ehTelaDeMinutaAreaTrabalho() {
    const params = new URLSearchParams(location.search);
    const acao = (params.get('acao') || '').toLowerCase();
    if (acao === 'minuta_area_trabalho') return true;
    const inpAcao = document.getElementById('acao');
    if (inpAcao && String(inpAcao.value || '').toLowerCase() === 'minuta_area_trabalho') return true;
    return false;
  }

  /* [MÓDULO INTIMAÇÕES - v3.5.5] Detecção da tela de Intimação Eletrônica */
  function ehTelaDeIntimacao() {
    const params = new URLSearchParams(location.search);
    const acao = (params.get('acao') || '').toLowerCase();
    if (acao === 'processo_intimacao' || acao === 'processo_intimacao_bloco') return true;
    const inpAcao = document.getElementById('acao');
    if (inpAcao && ['processo_intimacao', 'processo_intimacao_bloco'].includes(String(inpAcao.value || '').toLowerCase())) return true;
    return false;
  }

  function ehTelaSuportada() {
    return ehTelaDeMinuta() || ehTelaDeRelatorio() || ehTelaDeMovimentacao() || ehTelaDeMinutaAreaTrabalho() || ehTelaDeIntimacao();
  }

  let moduloAtivo = ehTelaDeIntimacao()
    ? 'intimacoes'
    : (ehTelaDeMinutaAreaTrabalho()
      ? 'area_minutas'
      : (ehTelaDeRelatorio()
        ? 'relatorios'
        : (ehTelaDeMovimentacao()
          ? 'movimentacoes'
          : (ehTelaDeMinuta()
            ? 'minutas'
            : (sessionStorage.getItem('eproc_pref_2g_modulo_ativo') || 'minutas')))));

  function gerarStatusTelaHtml() {
    if (moduloAtivo === 'minutas') {
      if (ehTelaDeMinuta()) {
        return '<span style="color:#15803d; font-weight:700;">✅ Nova Minuta (Pronto)</span>';
      } else {
        return '<div style="background:#fffbeb; border:1px solid #fde68a; border-radius:5px; padding:6px 8px; color:#92400e; font-size:11.5px; line-height:1.4; margin-top:2px;">⚠️ <strong>Tela incompatível:</strong> Acesse a tela de <strong>Nova Minuta</strong> no processo para gravar preferências deste módulo.</div>';
      }
    } else if (moduloAtivo === 'movimentacoes') {
      if (ehTelaDeMovimentacao()) {
        return '<span style="color:#15803d; font-weight:700;">✅ Movimentação Processual (Pronto)</span>';
      } else {
        return '<div style="background:#fffbeb; border:1px solid #fde68a; border-radius:5px; padding:6px 8px; color:#92400e; font-size:11.5px; line-height:1.4; margin-top:2px;">⚠️ <strong>Tela incompatível:</strong> Acesse a tela de <strong>Movimentação Processual</strong> no processo para gravar preferências deste módulo.</div>';
      }
    } else if (moduloAtivo === 'area_minutas') {
      if (ehTelaDeMinutaAreaTrabalho()) {
        return '<span style="color:#15803d; font-weight:700;">✅ Área de Trabalho de Minutas (Pronto)</span>';
      } else {
        return '<div style="background:#fffbeb; border:1px solid #fde68a; border-radius:5px; padding:6px 8px; color:#92400e; font-size:11.5px; line-height:1.4; margin-top:2px;">⚠️ <strong>Tela incompatível:</strong> Acesse a tela de <strong>Minutas > Área de Trabalho</strong> para gravar preferências deste módulo.</div>';
      }
    } else if (moduloAtivo === 'intimacoes') {
      if (ehTelaDeIntimacao()) {
        return '<span style="color:#15803d; font-weight:700;">✅ Intimação Eletrônica (Pronto)</span>';
      } else {
        return '<div style="background:#fffbeb; border:1px solid #fde68a; border-radius:5px; padding:6px 8px; color:#92400e; font-size:11.5px; line-height:1.4; margin-top:2px;">⚠️ <strong>Tela incompatível:</strong> Acesse a tela de <strong>Intimação Eletrônica</strong> do processo para gravar preferências deste módulo.</div>';
      }
    } else {
      if (ehTelaDeRelatorio()) {
        return '<span style="color:#15803d; font-weight:700;">✅ Relatório Geral de Processos (Pronto)</span>';
      } else {
        return '<div style="background:#fffbeb; border:1px solid #fde68a; border-radius:5px; padding:6px 8px; color:#92400e; font-size:11.5px; line-height:1.4; margin-top:2px;">⚠️ <strong>Tela incompatível:</strong> Acesse o menu <strong>Relatório Geral de Processos</strong> para gravar preferências deste módulo.</div>';
      }
    }
  }

  function obterHashAtual() {
    try {
      const params = new URLSearchParams(window.location.search);
      const h = params.get('hash');
      if (h) return h;
      const inpHash = document.querySelector('input[name="hash"]');
      if (inpHash && inpHash.value) return inpHash.value;
      const formWithHash = document.querySelector('form[action*="hash="]');
      if (formWithHash) {
        const m = formWithHash.getAttribute('action').match(/[?&]hash=([a-f0-9]{32})/i);
        if (m) return m[1];
      }
      const linkWithHash = document.querySelector('a[href*="hash="]');
      if (linkWithHash) {
        const m = linkWithHash.getAttribute('href').match(/[?&]hash=([a-f0-9]{32})/i);
        if (m) return m[1];
      }
    } catch (e) {}
    return '';
  }

  function alternarModulo(novoModulo) {
    moduloAtivo = novoModulo;
    sessionStorage.setItem('eproc_pref_2g_modulo_ativo', novoModulo);

    const mapBotoes = {
      minutas: document.getElementById('btn-modulo-minutas'),
      relatorios: document.getElementById('btn-modulo-relatorios'),
      movimentacoes: document.getElementById('btn-modulo-movimentacoes'),
      area_minutas: document.getElementById('btn-modulo-area-minutas'),
      intimacoes: document.getElementById('btn-modulo-intimacoes')
    };

    Object.entries(mapBotoes).forEach(([chave, btn]) => {
      if (!btn) return;
      if (chave === moduloAtivo) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const stDiv = document.getElementById('rito-status-tela');
    if (stDiv) stDiv.innerHTML = gerarStatusTelaHtml();

    const btnGerenciador = document.getElementById('btn-rito-abrir-gerenciador');
    if (btnGerenciador) {
      if (moduloAtivo === 'relatorios') {
        btnGerenciador.innerHTML = '<span>📋</span> Listar Preferências de Relatório Geral';
        btnGerenciador.title = 'Abre a lista de preferências de Relatório Geral da Unidade';
      } else if (moduloAtivo === 'movimentacoes') {
        btnGerenciador.innerHTML = '<span>📋</span> Abrir Gerenciador de Preferências (Movimentação)';
        btnGerenciador.title = 'Abre a tela oficial do eproc para visualizar ou editar preferências de movimentação processual';
      } else if (moduloAtivo === 'area_minutas') {
        btnGerenciador.innerHTML = '<span>📋</span> Listar Preferências da Área de Minutas';
        btnGerenciador.title = 'Abre a lista oficial de preferências da Área de Trabalho de Minutas da Unidade';
      } else if (moduloAtivo === 'intimacoes') {
        btnGerenciador.innerHTML = '<span>📋</span> Listar Preferências de Intimação';
        btnGerenciador.title = 'Abre a lista oficial de preferências de Intimação Eletrônica da Unidade';
      } else {
        btnGerenciador.innerHTML = '<span>📋</span> Abrir Gerenciador de Preferências (Minutas)';
        btnGerenciador.title = 'Abre a tela oficial do eproc para visualizar ou editar preferências de minutas';
      }
    }

    // Se a planilha já foi carregada em memória, reprocessa para a aba correspondente sem recarregar a página
    if (window._eprocUltimoArquivoPlanilha) {
      const nomeAba = moduloAtivo === 'intimacoes'
        ? 'Preferências - Intimações'
        : (moduloAtivo === 'relatorios'
          ? 'Preferências - Relatório Geral'
          : (moduloAtivo === 'movimentacoes'
            ? 'Preferências - Movimentar'
            : (moduloAtivo === 'area_minutas' ? 'Preferências - Área de Minutas' : 'Preferências - Minutas')));
      addLog('🔄 Aba selecionada: ' + nomeAba + '. Carregando dados...');
      carregarArquivo(window._eprocUltimoArquivoPlanilha);
    }
  }

  /* ================== BLOQUEIO DE RELOAD / SUBMIT DA PÁGINA ================== */
  // O eproc chama atualizaComboPreferencias() -> changePreferencia() -> form.submit() após salvar cada preferência.
  // Suprimimos ambos para que a página NÃO recarregue e o lote continue do item 1 até o fim!
  const changePreferenciaOriginal = window.changePreferencia;
  window.changePreferencia = function () {
    if (execucaoLoteAtiva || gravacaoEmAndamento) {
      console.log('[eproc] changePreferencia() suprimido durante lote para impedir recarregamento da página.');
      return false;
    }
    if (typeof changePreferenciaOriginal === 'function') {
      return changePreferenciaOriginal.apply(this, arguments);
    }
  };

  const atualizaComboPreferenciasOriginal = window.atualizaComboPreferencias;
  window.atualizaComboPreferencias = function () {
    if (execucaoLoteAtiva || gravacaoEmAndamento) {
      console.log('[eproc] atualizaComboPreferencias() suprimido durante lote para impedir changePreferencia/reload.');
      return false;
    }
    if (typeof atualizaComboPreferenciasOriginal === 'function') {
      return atualizaComboPreferenciasOriginal.apply(this, arguments);
    }
  };



  const formSubmitOriginal = HTMLFormElement.prototype.submit;
  HTMLFormElement.prototype.submit = function () {
    if (execucaoLoteAtiva || gravacaoEmAndamento) {
      console.log('[eproc] form.submit() bloqueado durante execução em lote:', this.id || this.name || this.action);
      return false;
    }
    return formSubmitOriginal.apply(this, arguments);
  };

  if (window.jQuery && window.jQuery.fn) {
    try {
      const jqSubmitOrig = window.jQuery.fn.submit;
      window.jQuery.fn.submit = function () {
        if (execucaoLoteAtiva || gravacaoEmAndamento) {
          console.log('[eproc] jQuery form.submit() bloqueado durante lote:', this[0] && (this[0].id || this[0].name));
          return this;
        }
        return jqSubmitOrig.apply(this, arguments);
      };
    } catch (e) {}
  }

  // Intercepta qualquer evento de submit nativo disparado no documento
  document.addEventListener('submit', function (e) {
    if (execucaoLoteAtiva || gravacaoEmAndamento) {
      console.log('[eproc] Submit event suprimido no document durante lote.');
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }
  }, true);

  // Intercepta qualquer clique acidental em links <a> externos ou botões com href fora do painel
  document.addEventListener('click', function (e) {
    if (execucaoLoteAtiva || gravacaoEmAndamento) {
      const link = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (link && !link.closest('#painel-preferencias-rito')) {
        const href = (link.getAttribute('href') || '').trim();
        if (href && !href.startsWith('javascript:void') && !href.startsWith('#')) {
          console.log('[eproc] clique em link <a> cancelado durante lote:', href);
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          return false;
        }
      }
    }
  }, true);



  window.addEventListener('beforeunload', (e) => {

    if (execucaoLoteAtiva || gravacaoEmAndamento) {

      e.preventDefault();

      e.returnValue = 'Execução de lote em andamento. Deseja sair?';

      return e.returnValue;

    }

  });



  /* ================== INTERCEPTADOR DE ALERTS E CONFIRMS ================== */

  const alertOriginal = window.alert;

  window.alert = function (msg) {

    ultimoAvisoEproc = String(msg || '');

    if (execucaoLoteAtiva || gravacaoEmAndamento) {

      console.log('[eproc Alert]:', msg);

      addLog(`[Aviso do Sistema]: ${ultimoAvisoEproc}`);

    } else {

      alertOriginal.call(window, msg);

    }

  };



  const confirmOriginal = window.confirm;

  window.confirm = function (msg) {

    ultimoAvisoEproc = String(msg || '');

    if (execucaoLoteAtiva || gravacaoEmAndamento) {

      console.log('[eproc Confirm auto-aceito]:', msg);

      addLog(`[Confirmação aceita]: ${ultimoAvisoEproc}`);

      return true;

    }

    return confirmOriginal.call(window, msg);

  };



  /* ================== MAPA DE MODELOS GENÉRICOS (BASEADO NO EVENTO E NOME) ================== */

  const LISTA_MODELOS_GENERICOS = [

    '***ALVARÁ***',

    '***ATO ORDINATÓRIO***',

    '***AUTOS***',

    '***CERTIDÃO***',

    '***CERTIDÃO DE CARTÓRIO***',

    '***CARTA AR DIGITAL***',

    '***CARTA PRECATÓRIA***',

    '***CARTA ROGATÓRIA***',

    '***CARTA CONVITE - ENVIA CORREIOS***',

    '***CARTA DE ADJUDICAÇÃO***',

    '***CARTA DE ALIENAÇÃO***',

    '***CARTA DE ARREMATAÇÃO***',

    '***DESPACHO/DECISÃO***',

    '***DESPACHO/OFÍCIO***',

    '***EDITAL (DJEN)***',

    '***INFORMAÇÃO***',

    '***MANDADO - CEMAN***',

    '***MANDADOS - OUTROS***',

    '***OFÍCIO***',

    '***PARECER TÉCNICO***',

    '***ACÓRDÃO***',

    '***TERMO DE AJUIZAMENTO***',

    '***TERMO DE AUDIÊNCIA***',

    '***TERMOS***'

  ];



  function ehNomeModeloGenerico(str) {

    if (!str) return false;

    const sTrim = String(str).trim();

    if (sTrim.startsWith('***') || sTrim.endsWith('***')) return true;

    const n = normalizar(sTrim).replace(/[\s\-_/*]+/g, '');

    const genericos = new Set([

      'despachodecisao',

      'despachooficio',

      'sentenca',

      'acordao',

      'atoordinatorio',

      'mandado',

      'mandadoceman',

      'mandadosoutros',

      'cartaprecatoria',

      'cartarogatoria',

      'cartaconvite',

      'cartaconviteenviacorreios',

      'cartaardigital',

      'cartaadjudicacao',

      'cartadeadjudicacao',

      'cartaalienacao',

      'cartadealienacao',

      'cartaarrematacao',

      'cartadearrematacao',

      'alvara',

      'certidao',

      'certidaocartorio',

      'certidaodecartorio',

      'oficio',

      'edital',

      'editaldjen',

      'termo',

      'termoaudiencia',

      'termodeaudiencia',

      'termoajuizamento',

      'termodeajuizamento',

      'termos',

      'autos',

      'informacao',

      'parecertecnico',

      'decisao',

      'despacho'

    ]);

    return genericos.has(n);

  }



  function extrairTermoBuscaGenerico(nomeOuModelo) {

    const n = normalizar(nomeOuModelo || '');

    if (n.includes('senten') || n.includes('acord')) return 'ACORDAO';

    if (n.includes('oficio') && (n.includes('despacho') || n.includes('decis'))) return 'DESPACHO';

    if (n.includes('despacho') || n.includes('decis')) return 'DESPACHO';

    if (n.includes('ato') || n.includes('ordinat')) return 'ATO';

    if (n.includes('mandad')) return 'MANDADO';

    if (n.includes('precatoria')) return 'CARTA';

    if (n.includes('carta')) return 'CARTA';

    if (n.includes('certid')) return 'CERTIDAO';

    if (n.includes('alvara')) return 'ALVARA';

    if (n.includes('oficio')) return 'OFICIO';

    if (n.includes('edital')) return 'EDITAL';

    if (n.includes('termo')) return 'TERMO';

    if (n.includes('autos')) return 'AUTOS';

    if (n.includes('informacao')) return 'INFORMACAO';

    if (n.includes('parecer')) return 'PARECER';

    return 'DESPACHO';

  }



  /* ================== MODELO GENÉRICO (REGRA: NOME ATÉ O PRIMEIRO HÍFEN) ================== */

  function determinarModeloGenerico(item) {

    if (item.modeloGenericoFixo && item.modeloGenericoFixo.startsWith('***') && item.modeloGenericoFixo.endsWith('***')) {

      const fixo = item.modeloGenericoFixo.trim();

      const nFixo = normalizar(fixo);

      let chave = 'despacho';

      let termo = 'DESPACHO';

      // CRÍTICO: 'precator' DEVE vir antes de 'ato' e 'carta', pois 'precATORIA' contém a substring 'ato'!

      if (nFixo.includes('precator')) { chave = 'precatoria'; termo = 'PRECATORIA'; }

      else if (nFixo.includes('senten') || nFixo.includes('acord')) { chave = 'senten'; termo = 'ACORDAO'; }

      else if (nFixo.includes('mandad')) { chave = 'mandado'; termo = 'MANDADO'; }

      else if (nFixo.includes('ordinat') || /\bato\b/.test(nFixo)) { chave = 'ato'; termo = 'ATO ORDINATÓRIO'; }

      else if (nFixo.includes('carta')) { chave = 'carta'; termo = 'CARTA'; }

      else if (nFixo.includes('certid')) { chave = 'certid'; termo = 'CERTIDAO'; }

      else if (nFixo.includes('oficio')) { chave = 'despacho'; termo = 'DESPACHO'; }

      return { nomeModelo: fixo, termoBusca: termo, chave: chave };

    }



    const raw = (item.modeloNome || '').trim();

    const mNorm = normalizar(raw);

    const evNorm = normalizar(item.evento || '');

    const nomeNorm = normalizar(item.nome || '');

    const comb = `${mNorm} ${evNorm} ${nomeNorm}`;



    // 1. Precatória (Prioridade para evitar falso-positivo em "ato" de "precATORIA" ou em "carta" de "CARTA precatória")

    if (mNorm.includes('precator') || (!mNorm && comb.includes('precator'))) {

      return { nomeModelo: '***CARTA PRECATÓRIA***', termoBusca: 'PRECATORIA', chave: 'precatoria' };

    }



    // 2. Despacho / Decisão

    if (mNorm.includes('despacho') || mNorm.includes('decis') || (!mNorm && (comb.includes('despacho') || comb.includes('decis')))) {

      if (mNorm.includes('oficio') || comb.includes('oficio')) {

        return { nomeModelo: '***DESPACHO/OFÍCIO***', termoBusca: 'DESPACHO', chave: 'despacho' };

      }

      return { nomeModelo: '***DESPACHO/DECISÃO***', termoBusca: 'DESPACHO/DECISÃO', chave: 'despacho' };

    }



    // 3. Sentença

    if (mNorm.includes('senten') || mNorm.includes('acord') || (!mNorm && (comb.includes('senten') || comb.includes('acord')))) {

      return { nomeModelo: '***ACÓRDÃO***', termoBusca: 'ACORDAO', chave: 'senten' };

    }



    // 4. Mandado

    if (mNorm.includes('mandad') || (!mNorm && comb.includes('mandad'))) {

      return { nomeModelo: '***MANDADO - CEMAN***', termoBusca: 'MANDADO', chave: 'mandado' };

    }



    // 5. Ato Ordinatório (usando \bato\b para nunca casar como substring de precATORIA)

    if (mNorm.includes('ordinat') || /\bato\b/.test(mNorm) || (!mNorm && (comb.includes('ordinat') || /\bato\b/.test(comb)))) {

      return { nomeModelo: '***ATO ORDINATÓRIO***', termoBusca: 'ATO ORDINATÓRIO', chave: 'ato' };

    }



    // 6. Certidão

    if (mNorm.includes('certid') || (!mNorm && comb.includes('certid'))) {

      return { nomeModelo: '***CERTIDÃO DE CARTÓRIO***', termoBusca: 'CERTIDAO', chave: 'certid' };

    }



    // 7. Carta AR / Comunicação Postal

    if (mNorm.includes('carta') || (!mNorm && comb.includes('carta'))) {

      return { nomeModelo: '***CARTA AR DIGITAL***', termoBusca: 'CARTA', chave: 'carta' };

    }



    return { nomeModelo: '***DESPACHO/DECISÃO***', termoBusca: 'DESPACHO', chave: 'despacho' };

  }



  /* ================== PARSER DE PLANILHA ================== */

  function colParaIndice(colStr) {

    let idx = 0;

    for (let i = 0; i < colStr.length; i++) {

      idx = idx * 26 + (colStr.charCodeAt(i) - 64);

    }

    return idx - 1;

  }



  async function lerPlanilhaExcel(file) {

    if (!window.JSZip) throw new Error('Biblioteca JSZip não carregada.');

    const buf = await file.arrayBuffer();

    const zip = await window.JSZip.loadAsync(buf);



    const wbXml = await zip.file('xl/workbook.xml').async('text');

    const parser = new DOMParser();

    const relsFile = zip.file('xl/_rels/workbook.xml.rels');

    const relsXml = relsFile ? await relsFile.async('text') : '';



    const relMap = {};

    if (relsXml) {

      const relRegex = /<Relationship\b([^>]+)>/gi;

      let mRel;

      while ((mRel = relRegex.exec(relsXml)) !== null) {

        const attrs = mRel[1];

        const idMatch = attrs.match(/\bId=["']([^"']+)["']/i);

        const targetMatch = attrs.match(/\bTarget=["']([^"']+)["']/i);

        if (idMatch && targetMatch) {

          relMap[idMatch[1]] = targetMatch[1];

        }

      }

    }



    window._eprocUltimoArquivoPlanilha = file;

    let targetSheetPath = '';

    let sheetNameEncontrada = '';



    const buscaTermo = moduloAtivo === 'intimacoes'
      ? 'intimac'
      : (moduloAtivo === 'relatorios'
        ? 'relat'
        : (moduloAtivo === 'movimentacoes'
          ? 'moviment'
          : (moduloAtivo === 'area_minutas' ? 'area' : 'minuta')));

    const sheetRegex = /<sheet\b([^>]+)>/gi;

    let mSheet;

    while ((mSheet = sheetRegex.exec(wbXml)) !== null) {

      const attrs = mSheet[1];

      const nameMatch = attrs.match(/\bname=["']([^"']+)["']/i);

      const ridMatch = attrs.match(/\b(?:r:id|id)=["']([^"']+)["']/i);

      if (nameMatch && ridMatch) {

        const sName = decodeEntities(nameMatch[1]).trim();

        const norm = normalizar(sName);

        const rid = ridMatch[1];

        const target = relMap[rid];

        if (target) {

          const fullPath = 'xl/' + target.replace(/^\//, '').replace(/^xl\//, '');

          let condicaoAba = false;
          if (moduloAtivo === 'intimacoes') {
            condicaoAba = norm.includes('intimac') || norm.includes('citac');
          } else if (moduloAtivo === 'area_minutas') {
            condicaoAba = norm.includes('area') || norm.includes('trabalho') || (norm.includes('minuta') && norm.includes('doc'));
          } else if (moduloAtivo === 'minutas') {
            condicaoAba = norm.includes('minuta') && !norm.includes('area') && !norm.includes('trabalho');
          } else if (moduloAtivo === 'relatorios') {
            condicaoAba = norm.includes('relat');
          } else if (moduloAtivo === 'movimentacoes') {
            condicaoAba = norm.includes('moviment');
          }

          if (condicaoAba) {

            targetSheetPath = fullPath;

            sheetNameEncontrada = sName;

            break;

          } else if (norm.includes('prefer') && !targetSheetPath) {

            targetSheetPath = fullPath;

            sheetNameEncontrada = sName;

          }

        }

      }

    }



    // Fallback 1: Primeira sheet encontrada no workbook.xml

    if (!targetSheetPath) {

      const anySheet = /<sheet\s+[^>]*name=["']([^"']+)["']/i.exec(wbXml);

      if (anySheet) sheetNameEncontrada = decodeEntities(anySheet[1]).trim();

      if (zip.file('xl/worksheets/sheet1.xml')) {

        targetSheetPath = 'xl/worksheets/sheet1.xml';

      }

    }



    // Fallback 2: Qualquer arquivo de worksheet presente no zip

    let sheetFile = targetSheetPath ? zip.file(targetSheetPath) : null;

    if (!sheetFile) {

      const sheetFiles = Object.keys(zip.files).filter(k => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k));

      if (sheetFiles.length > 0) {

        targetSheetPath = sheetFiles[0];

        sheetFile = zip.file(targetSheetPath);

        if (!sheetNameEncontrada) sheetNameEncontrada = 'Preferências';

      }

    }



    const sharedStrings = [];

    const ssFile = zip.file('xl/sharedStrings.xml');

    if (ssFile) {

      const ssXml = await ssFile.async('text');

      const ssDoc = parser.parseFromString(ssXml, 'text/xml');

      ssDoc.querySelectorAll('si').forEach(si => {

        const textParts = Array.from(si.querySelectorAll('t')).map(t => t.textContent || '');

        sharedStrings.push(textParts.join(''));

      });

    }



    if (!sheetFile) sheetFile = zip.file(targetSheetPath);

    if (!sheetFile) throw new Error('Aba não encontrada.');

    const sheetXml = await sheetFile.async('text');

    const sheetDoc = parser.parseFromString(sheetXml, 'text/xml');



    const rows = sheetDoc.querySelectorAll('row');

    const tabela = [];

    rows.forEach(r => {

      const rowDict = {};

      r.querySelectorAll('c').forEach(c => {

        const ref = c.getAttribute('r');

        const match = ref.match(/^([A-Z]+)(\d+)$/);

        if (!match) return;

        const colIdx = colParaIndice(match[1]);



        const t = c.getAttribute('t');

        const vEl = c.querySelector('v');

        const isEl = c.querySelector('is');

        let valor = '';

        if (t === 's' && vEl) {

          valor = sharedStrings[parseInt(vEl.textContent, 10)] || '';

        } else if (isEl) {

          valor = Array.from(isEl.querySelectorAll('t')).map(x => x.textContent || '').join('');

        } else if (vEl) {

          valor = vEl.textContent || '';

        }

        rowDict[colIdx] = valor.trim();

      });

      tabela.push(rowDict);

    });



    if (moduloAtivo === 'relatorios') {
      return { sheetName: sheetNameEncontrada, itens: converterTabelaParaItensRelatorios(tabela) };
    }
    if (moduloAtivo === 'movimentacoes') {
      return { sheetName: sheetNameEncontrada, itens: converterTabelaParaItensMovimentacoes(tabela) };
    }
    if (moduloAtivo === 'area_minutas') {
      return { sheetName: sheetNameEncontrada, itens: converterTabelaParaItensAreaMinutas(tabela) };
    }
    if (moduloAtivo === 'intimacoes') {
      return { sheetName: sheetNameEncontrada, itens: converterTabelaParaItensIntimacoes(tabela) };
    }
    return { sheetName: sheetNameEncontrada, itens: converterTabelaParaItens(tabela) };
  }

  
  /* ========================================================================== */
  /* [MÓDULO INTIMAÇÕES - v3.5.5] PARSER DA PLANILHA OFICIAL DE INTIMAÇÕES        */
  /* ========================================================================== */
  function converterTabelaParaItensIntimacoes(tabela) {
    if (!tabela || tabela.length === 0) return [];
    const itens = [];

    const cab = tabela[0] || {};
    let colNum = 0, colFluxo = 1, colFerramenta = 2, colNome = 3, colComoSalvar = 4, colGrupo = 5;
    let colEvento = 6, colCodigoEvento = 7, colModoPrazos = 8, colPrazoEspEnt = 9, colPrazoSimpEnt = 10, colPrazoSimpDemais = 11, colPrazoDPU = 12;
    let colPrazoAutores = 13, colPrazoReus = 14, colPrazoInteressados = 15, colPrazoMP = 16, colUrgente = 17;
    let colComportamentoLoc = 18, colNovoLoc = 19, colLocDesativar = 20, colEncIntimacao = 21, colEventoEncIntimacao = 22, colObs = 23;

    for (const [idxStr, rawHeader] of Object.entries(cab)) {
      const c = parseInt(idxStr, 10);
      const h = normalizar(rawHeader);
      if (!h) continue;
      if (h === 'no' || h === 'n' || h === 'num' || h === 'numero') colNum = c;
      else if (h === 'fluxo') colFluxo = c;
      else if (h.includes('ferramenta')) colFerramenta = c;
      else if (h.includes('obs') || h.includes('orientac')) colObs = c;
      else if (h.includes('nome')) colNome = c;
      else if (h.includes('como salvar') || h.includes('opcoes padrao')) colComoSalvar = c;
      else if (h.includes('grupo')) colGrupo = c;
      else if ((h.includes('codigo') || h.includes('cod')) && h.includes('evento')) colCodigoEvento = c;
      else if (h.includes('evento encadeado')) colEventoEncIntimacao = c;
      else if (h.includes('evento de citacao') || h.includes('evento de intimacao') || (h.includes('evento') && !h.includes('encadeado') && !h.includes('codigo') && !h.includes('cod'))) colEvento = c;
      else if (h.includes('modo de prazo') || h.includes('modo')) colModoPrazos = c;
      else if (h.includes('especial') && h.includes('entidade')) colPrazoEspEnt = c;
      else if (h.includes('simples') && h.includes('entidade')) colPrazoSimpEnt = c;
      else if (h.includes('simples') && (h.includes('demais') || h.includes('parte'))) colPrazoSimpDemais = c;
      else if (h.includes('dpu') || h.includes('defensoria')) colPrazoDPU = c;
      else if (h.includes('ativo') || h.includes('autores')) colPrazoAutores = c;
      else if (h.includes('passivo') || h.includes('reus')) colPrazoReus = c;
      else if (h.includes('interessad') || h.includes('terceir')) colPrazoInteressados = c;
      else if (h.includes('comportamento') || h.includes('comportamento do loc')) colComportamentoLoc = c;
      else if (h.includes('custos') || h.includes('ministerio') || h.includes('prazo mp') || /\bmp\b/.test(h)) colPrazoMP = c;
      else if (h.includes('urgente')) colUrgente = c;
      else if (h.includes('novo loc') || h.includes('destino')) colNovoLoc = c;
      else if (h.includes('desativar') || h.includes('remover')) colLocDesativar = c;
      else if (h.includes('encadeamento') && !h.includes('evento')) colEncIntimacao = c;
    }

    const strVal = v => (v !== undefined && v !== null ? String(v).replace(/[\u200B-\u200D\uFEFF]/g, '').trim() : '');

    for (let r = 1; r < tabela.length; r++) {
      const row = tabela[r];
      if (!row) continue;
      const nome = strVal(row[colNome]);
      if (!nome) continue;

      const rawNum = row[colNum];
      const numVal = parseInt(rawNum, 10);
      const comoSalvarStr = strVal(row[colComoSalvar] || 'Unidade | Localizadores selecionados | Ação preferencial');
      const normComoSalvar = normalizar(comoSalvarStr);
      const ehIndividual = normComoSalvar.includes('individual') && !normComoSalvar.includes('unidade');
      const acaoPreferencial = normComoSalvar.includes('acao preferencial') || normComoSalvar.includes('preferencial');
      const padrao = normComoSalvar.includes('padrao') && !normComoSalvar.includes('nao padrao');

      const modoPrazosStr = strVal(row[colModoPrazos] || 'Por Polo');
      const normModoPrazos = normalizar(modoPrazosStr);

      const urgenteStr = strVal(row[colUrgente]);
      const normUrgente = normalizar(urgenteStr);
      const ehUrgente = normUrgente === 'sim' || normUrgente === 's' || normUrgente === 'true';

      const comportamentoStr = strVal(row[colComportamentoLoc] || 'NÃO remover de localizador algum');
      const normComp = normalizar(comportamentoStr);
      let tipoLocalizador = 'L'; // 'L' = Localizadores selecionados
      if (normComp.includes('marcar todos') && !normComp.includes('desmarcar')) {
        tipoLocalizador = 'M';
      } else if (normComp.includes('desmarcar todos') || normComp.includes('remover todos')) {
        tipoLocalizador = 'D';
      }

      const encIntimacaoStr = strVal(row[colEncIntimacao]);
      const encIntimacao = normalizar(encIntimacaoStr) === 'sim' || normalizar(encIntimacaoStr) === 's';

      const codEvento = strVal(row[colCodigoEvento]);

      const item = {
        linha: r + 1,
        num: (rawNum !== undefined && rawNum !== null && String(rawNum).trim() !== '') ? String(rawNum).trim() : String(r),
        numero: isNaN(numVal) ? r : numVal,
        fluxo: strVal(row[colFluxo]),
        ferramenta: strVal(row[colFerramenta] || 'Intimação Eletrônica'),
        nome: nome,
        comoSalvar: comoSalvarStr,
        rdPrefTipo: ehIndividual ? 'I' : 'U',
        tipo: ehIndividual ? 'Individual' : 'Unidade',
        acaoPreferencial: acaoPreferencial,
        padrao: padrao,
        grupo: strVal(row[colGrupo]),
        evento: strVal(row[colEvento]),
        codigoEvento: codEvento,
        modoPrazos: modoPrazosStr,
        normModoPrazos: normModoPrazos,
        prazoEspEnt: strVal(row[colPrazoEspEnt]),
        prazoSimpEnt: strVal(row[colPrazoSimpEnt]),
        prazoSimpDemais: strVal(row[colPrazoSimpDemais]),
        prazoDPU: strVal(row[colPrazoDPU]),
        prazoAutores: strVal(row[colPrazoAutores]),
        prazoReus: strVal(row[colPrazoReus]),
        prazoInteressados: strVal(row[colPrazoInteressados]),
        prazoMP: strVal(row[colPrazoMP]),
        urgente: ehUrgente,
        comportamentoLoc: comportamentoStr,
        rdPrefLocalizadores: tipoLocalizador,
        novoLocalizador: strVal(row[colNovoLoc]),
        locDesativar: strVal(row[colLocDesativar]),
        encadeamentoIntimacao: encIntimacao,
        eventoEncadeadoIntimacao: strVal(row[colEventoEncIntimacao]),
        obs: strVal(row[colObs])
      };
      itens.push(item);
    }

    return itens;
  }

  function converterTabelaParaItensAreaMinutas(tabela) {
    if (!tabela || tabela.length === 0) return [];
    const itens = [];

    // Identifica dinamicamente as colunas pelo cabeçalho (linha 0)
    const cab = tabela[0] || {};
    let colNum = 0, colNome = 1, colTipoDoc = 2, colStatus = 3, colLoc = 4, colCriador = 5, colTipoPref = 6, colGrupo = 7, colFiltros = 8, colObs = 9;

    for (const [idxStr, rawHeader] of Object.entries(cab)) {
      const c = parseInt(idxStr, 10);
      const h = normalizar(rawHeader);
      if (!h) continue;
      if (h === 'no' || h === 'n' || h === 'num' || h === 'numero') colNum = c;
      else if (h.includes('obs') || h.includes('nomenclatura')) colObs = c;
      else if (h.includes('nome')) colNome = c;
      else if (h.includes('documento')) colTipoDoc = c;
      else if (h.includes('status')) colStatus = c;
      else if (h.includes('localizador')) colLoc = c;
      else if (h.includes('criador') || h.includes('usuario')) colCriador = c;
      else if (h.includes('tipo de pref') || h.includes('tipo pref')) colTipoPref = c;
      else if (h.includes('grupo')) colGrupo = c;
      else if (h.includes('filtro')) colFiltros = c;
    }

    for (let r = 1; r < tabela.length; r++) {
      const row = tabela[r];
      if (!row) continue;
      const nome = (row[colNome] || '').trim();
      if (!nome) continue;

      const numVal = parseInt(row[colNum], 10);
      const rawTipoPref = (row[colTipoPref] || 'Unidade; Exibir no Painel Inicial').trim();
      const normTipoPref = normalizar(rawTipoPref);
      const ehIndividual = normTipoPref.includes('individual') && !normTipoPref.includes('unidade');
      const exibirPainel = normTipoPref.includes('painel') || normTipoPref.includes('exibir');
      const marcarPadrao = normTipoPref.includes('padrao');

      const item = {
        linha: r + 1,
        num: isNaN(numVal) ? r : numVal,
        numero: isNaN(numVal) ? r : numVal,
        nome: nome,
        tipoDocumento: (row[colTipoDoc] || '').trim(),
        statusMinuta: (row[colStatus] || '').trim(),
        localizador: (row[colLoc] || '').trim(),
        usuarioCriador: (row[colCriador] || '').trim(),
        tipoPref: rawTipoPref,
        rdPrefTipo: ehIndividual ? 'I' : 'U',
        exibirPainel: exibirPainel,
        marcarPadrao: marcarPadrao,
        grupo: (row[colGrupo] || '').trim(),
        filtrosOriginal: (row[colFiltros] || '').trim(),
        obs: (row[colObs] || '').trim()
      };
      itens.push(item);
    }

    return itens;
  }

  function converterTabelaParaItensMovimentacoes(tabela) {
    if (!tabela || tabela.length === 0) return [];
    const itens = [];

    // Identifica dinamicamente as colunas pelo cabeçalho (linha 0)
    const cab = tabela[0] || {};
    let colNum = 0, colFluxo = 1, colFerramenta = 2, colNome = 3, colComoSalvar = 4, colGrupo = 5;
    let colEvento = 6, colEventoCod = 7, colEventosComp = 8, colComportamento = 9, colNovoLoc = 10, colLocDesativar = 11, colObs = 12;

    for (const [idxStr, rawHeader] of Object.entries(cab)) {
      const c = parseInt(idxStr, 10);
      const h = normalizar(rawHeader);
      if (!h) continue;
      if (h === 'no' || h === 'n' || h === 'num' || h === 'numero') colNum = c;
      else if (h === 'fluxo') colFluxo = c;
      else if (h.includes('ferramenta')) colFerramenta = c;
      else if (h.includes('nome da preferencia') || h === 'preferencia' || h === 'nome') colNome = c;
      else if (h.includes('como salvar') || h.includes('opcoes padrao')) colComoSalvar = c;
      else if (h.includes('grupo')) colGrupo = c;
      else if (h.includes('codigo evento') || h.includes('cod evento') || h === 'codigo do evento') colEventoCod = c;
      else if (h.includes('evento complementar') || h.includes('eventos complementares')) colEventosComp = c;
      else if (h.includes('evento a ser lancado') || h === 'evento' || h.includes('evento')) colEvento = c;
      else if (h.includes('comportamento')) colComportamento = c;
      else if (h.includes('novo localizador') || h.includes('localizador destino')) colNovoLoc = c;
      else if (h.includes('desativar') || h.includes('remover')) colLocDesativar = c;
      else if (h.includes('observac') || h.includes('orientac')) colObs = c;
    }

    for (let i = 1; i < tabela.length; i++) {
      const row = tabela[i];
      const nome = String(row[colNome] || '').trim();
      if (!nome || nome === '-') continue;

      const rawGrupo = String(row[colGrupo] || '').trim();
      const grupoLimpo = (!rawGrupo || rawGrupo === '-' || normalizar(rawGrupo) === 'nenhum') ? '' : rawGrupo;

      const comoSalvarRaw = String(row[colComoSalvar] || 'Unidade | Localizadores selecionados | Ação preferencial').trim();
      const comoSalvarNorm = normalizar(comoSalvarRaw);
      const tipo = comoSalvarNorm.includes('individual') ? 'Individual' : 'Unidade';
      const acaoPreferencial = !comoSalvarNorm.includes('sem acao preferencial');
      const padrao = comoSalvarNorm.includes('marcar como padrao');

      const rawNovoLoc = String(row[colNovoLoc] || '').replace(/^localizador:\s*/i, '').trim();
      const locsDestino = rawNovoLoc.split(';').map(x => x.trim()).filter(x => x && x !== '-');

      const rawLocDes = String(row[colLocDesativar] || '').replace(/^localizador:\s*/i, '').trim();
      const locsDesativar = rawLocDes.split(';').map(x => x.trim()).filter(x => x && x !== '-');

      const rawEvComp = String(row[colEventosComp] || '').trim();
      const eventosComplementares = (!rawEvComp || rawEvComp === '-')
        ? []
        : rawEvComp.split(';').map(s => s.trim()).filter(s => s && s !== '-').map(s => {
            const mC = s.match(/\((\d+)\)/);
            return { nome: s, cod: mC ? mC[1] : (/^\d+$/.test(s) ? s : '') };
          });

      itens.push({
        num: String(row[colNum] || i).trim(),
        linha: i + 1,
        fluxo: String(row[colFluxo] || '').trim(),
        ferramenta: String(row[colFerramenta] || 'Movimentar').trim(),
        nome: nome,
        comoSalvar: comoSalvarRaw,
        tipo: tipo,
        grupo: grupoLimpo,
        acaoPreferencial: acaoPreferencial,
        padrao: padrao,
        evento: String(row[colEvento] || '').trim(),
        eventoCod: String(row[colEventoCod] || '').trim(),
        eventosComplementares: eventosComplementares,
        comportamento: String(row[colComportamento] || 'NÃO remover de localizador algum').trim(),
        novoLocalizador: locsDestino[0] || '',
        localizadores: locsDestino,
        localizadoresSecundarios: locsDestino.slice(1),
        localizadoresDesativar: locsDesativar,
        obs: String(row[colObs] || '').trim(),
        modulo: 'movimentacoes'
      });
    }
    return itens;
  }



  

  function converterTabelaParaItensRelatorios(tabela) {
    if (!tabela || tabela.length === 0) return [];
    const itens = [];

    // Identifica dinamicamente as colunas pelo cabeçalho (linha 0)
    const cab = tabela[0] || {};
    let colNum = 0, colNome = 1, colTipo = 2, colGrupo = 3, colPainel = 4, colPadrao = 5, colLoc = 6;
    let colOperacao = -1, colSituacao = 7, colLembrete = 8, colClasses = 9, colObs = 10;

    for (const [idxStr, rawHeader] of Object.entries(cab)) {
      const c = parseInt(idxStr, 10);
      const h = normalizar(rawHeader);
      if (!h) continue;
      if (h === 'no' || h === 'n' || h === 'num' || h === 'numero') colNum = c;
      else if (h.includes('nome da preferencia') || h === 'preferencia' || h === 'nome') colNome = c;
      else if (h.includes('tipo de preferencia') || h === 'tipo') colTipo = c;
      else if (h.includes('grupo')) colGrupo = c;
      else if (h.includes('painel inicial')) colPainel = c;
      else if (h.includes('padrao')) colPadrao = c;
      else if (h.includes('localizador')) colLoc = c;
      else if (h.includes('operacao') || h.includes('e ou') || h.includes('e/ou')) colOperacao = c;
      else if (h.includes('situacao')) colSituacao = c;
      else if (h.includes('lembrete')) colLembrete = c;
      else if (h.includes('classe')) colClasses = c;
      else if (h.includes('observac') || h.includes('orientac')) colObs = c;
    }

    // Se a coluna Operação foi detectada na posição 7 e as seguintes ainda estavam nos índices antigos, corrige deslocamento
    if (colOperacao === 7 && colSituacao === 7) {
      colSituacao = 8;
      colLembrete = 9;
      colClasses = 10;
      colObs = 11;
    }

    // Linha 0 é o cabeçalho
    for (let i = 1; i < tabela.length; i++) {
      const row = tabela[i];
      const nome = String(row[colNome] || '').trim();
      if (!nome || nome === '-') continue;

      const rawLoc = String(row[colLoc] || '').trim();
      // Ex: "Localizador: 🔶Apelação🔶; 👤Servidor 1👤"
      const locLimpo = rawLoc.replace(/^localizador:\s*/i, '');
      const localizadores = locLimpo.split(';').map(x => x.trim()).filter(x => x && x !== '-');

      const rawOp = colOperacao !== -1 ? String(row[colOperacao] || '').trim().toUpperCase() : '';
      const operacao = (rawOp === 'OU' || rawOp === 'E') ? rawOp : (localizadores.length === 2 ? 'E' : 'OU');

      const rawLem = String(row[colLembrete] || '').trim();
      const lemNorm = normalizar(rawLem);
      const lembreteLimpo = (!rawLem || rawLem === '-' || lemNorm === 'todos' || lemNorm === 'movimento' || lemNorm === 'suspenso' || lemNorm === 'baixado') ? '' : rawLem;

      itens.push({
        num: String(row[colNum] || i).trim(),
        linha: i + 1,
        nome: nome,
        tipo: String(row[colTipo] || 'Unidade').trim(),
        grupo: String(row[colGrupo] || '').trim(),
        painelInicial: normalizar(row[colPainel]) === 'sim',
        padrao: normalizar(row[colPadrao]) === 'sim',
        localizadores: localizadores,
        operacao: operacao,
        situacao: String(row[colSituacao] || 'TODOS').trim(),
        lembrete: lembreteLimpo,
        classes: String(row[colClasses] || '').split(';').map(x => x.trim()).filter(x => x && x !== '-'),
        obs: String(row[colObs] || '').trim(),
        modulo: 'relatorios'
      });
    }
    return itens;
  }

  function parseDadosComplementares(str) {

    if (!str || str.trim() === '-' || str.trim() === '') return [];

    const itens = str.split(';');

    const pares = [];

    for (let rawItem of itens) {

      rawItem = rawItem.trim().replace(/^["']|["']$/g, '').trim();

      if (!rawItem) continue;

      const colonIdx = rawItem.indexOf(':');

      if (colonIdx !== -1) {

        const campo = rawItem.slice(0, colonIdx).trim().replace(/^["']|["']$/g, '');

        const valor = rawItem.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');

        if (campo && valor) {

          pares.push({ campo, valor });

        }

      }

    }

    return pares;

  }



  function converterTabelaParaItens(tabela) {

    if (!tabela || tabela.length === 0) return [];



    let idxCab = 0;

    for (let i = 0; i < Math.min(8, tabela.length); i++) {

      const valores = Object.values(tabela[i]).map(v => normalizar(v));

      if (valores.some(v => v === 'preferencia:' || v.includes('preferencia') || v === 'nome') &&

          valores.some(v => v.includes('modelo') || v.includes('evento') || v.includes('ferramenta') || v.includes('localizador'))) {

        idxCab = i;

        break;

      }

    }



    const cab = tabela[idxCab];

    let colNome = -1, colEvento = -1, colEventoCod = -1, colModeloNome = -1, colModeloCod = -1, colModeloGenerico = -1;

    let colLoc = -1, colLocSecundarios = -1, colComportamentoLoc = -1, colLocDesativar = -1, colClassif = -1, colDesc = -1, colFerramenta = -1, colComoSalvarLoc = -1;

    let colEventoComplementar = -1, colDadosComplementares = -1;

    let colIntimar = -1, colEvIntimar = -1, colPzEsp = -1, colPzSimp = -1, colPzPartes = -1, colPzDPU = -1;

    let colRemeter = -1, colEvRemessa = -1, colOrgaoRemessa = -1, colGrupo = -1, colAssinante = -1;
    let colNum = -1;

    for (const [colIdxStr, txt] of Object.entries(cab)) {

      const c = parseInt(colIdxStr, 10);

      const n = normalizar(txt);

      if (colNum === -1 && (n === 'n' || n === 'no' || n === 'num' || n === 'numero' || n === 'item' || n === '#' || n === 'ordem')) colNum = c;

      if (colFerramenta === -1 && (n === 'ferramenta' || n.includes('ferramenta'))) colFerramenta = c;

      if (colNome === -1 && (n === 'preferencia:' || n.includes('nome da preferencia') || n.includes('descricao da preferencia') || n === 'nome')) colNome = c;

      if (colComoSalvarLoc === -1 && n.includes('como salvar')) colComoSalvarLoc = c;

      

      // Localizadores (suporte a coluna única ou colunas separadas: Principal e Secundários)

      // Comportamento do Localizador e Localizadores (Principal, Secundários, Remover) - [v3.5.6]
      if (colComportamentoLoc === -1 && (n.includes('comportamento') || n.includes('comportamento do localizador'))) {
        colComportamentoLoc = c;
      } else if (colLocDesativar === -1 && (n.includes('remover localizador') || n.includes('desativar') || n.includes('remover') || n.includes('localizador a remover') || n.includes('localizadores a desativar'))) {
        colLocDesativar = c;
      } else if (colLocSecundarios === -1 && (n.includes('secundari') || n.includes('outros localizadores'))) {
        colLocSecundarios = c;
      } else if (colLoc === -1 && (n.includes('localizador principal') || n.includes('principal') || n.includes('novo localizador') || n.includes('localizador de saida') || (n.includes('localizador') && !n.includes('como salvar') && !n.includes('opcao')))) {
        colLoc = c;
      }



      if (n.includes('generico') && (n.includes('modelo') || n.includes('fallback'))) {

        colModeloGenerico = c;

      } else if (colModeloNome === -1 && (n.includes('tipo de documento') || n.includes('especifico') || n.includes('nome do modelo') || n === 'modelo')) {

        colModeloNome = c;

      }

      

      if (colModeloCod === -1 && (n.includes('codigo do modelo') || n.includes('codigo modelo') || n.includes('cod modelo'))) colModeloCod = c;

      if (colEventoCod === -1 && (n.includes('codigo evento') || n.includes('cod evento') || n === 'codigo do evento')) colEventoCod = c;



      // Dado Complementar

      if (colDadosComplementares === -1 && (

        n.includes('dado complementar') || 

        n.includes('dados complementares') || 

        n === 'dado complementar' || 

        n === 'dados complementares' || 

        (n.includes('dado') && n.includes('complementar')) ||

        n.includes('autuacao') || 

        n.includes('antecipacao') || 

        n.includes('tutela')

      )) {

        colDadosComplementares = c;

      }



      // Evento Complementar

      if (colEventoComplementar === -1 && !n.includes('dado') && (

        n.includes('evento complementar') || 

        n.includes('eventos complementares') || 

        n.includes('ato complementar') || 

        (n.includes('evento') && n.includes('complementar'))

      )) {

        colEventoComplementar = c;

      }

      if (colEvento === -1 && (n.includes('evento a ser lancado') || n === 'evento' || n.includes('ato a ser lancado') || n.includes('evento'))) colEvento = c;

      if (colClassif === -1 && n.includes('classifica')) colClassif = c;

      if (colDesc === -1 && (n.includes('descricao da minuta') || n === 'descricao:' || n === 'descricao')) colDesc = c;



      // Colunas Específicas 2G - Intimação e Remessa Encadeada:

      if (colIntimar === -1 && n.includes('intimar')) colIntimar = c;

      if (colEvIntimar === -1 && (n.includes('evento de intimacao') || n.includes('tipo de intimacao'))) colEvIntimar = c;

      if (colPzEsp === -1 && n.includes('prazo especial')) colPzEsp = c;

      if (colPzSimp === -1 && n.includes('prazo simples')) colPzSimp = c;

      if (colPzPartes === -1 && (n.includes('prazo partes') || n.includes('partes com prazo simples'))) colPzPartes = c;

      if (colPzDPU === -1 && (n.includes('prazo dpu') || n.includes('dpu'))) colPzDPU = c;

      if (colRemeter === -1 && n.includes('remeter')) colRemeter = c;

      if (colEvRemessa === -1 && n.includes('evento de remessa')) colEvRemessa = c;

      if (colOrgaoRemessa === -1 && (n.includes('orgao de remessa') || n.includes('orgao'))) colOrgaoRemessa = c;

      if (colAssinante === -1 && n.includes('assinante')) colAssinante = c;

      if (colGrupo === -1 && (n.includes('grupo de preferencia') || n.includes('grupo'))) colGrupo = c;

    }



    // Posições padrões 2G se cabeçalho não reconhecido:

    // Posições padrões 2G se cabeçalho não reconhecido (Atualizado v3.5.6 com Col H: Comportamento e Col I: Remover):
    if (colFerramenta === -1) colFerramenta = 2;
    if (colNome === -1) colNome = 3;
    if (colComoSalvarLoc === -1) colComoSalvarLoc = 4;
    if (colLoc === -1) colLoc = 5;
    if (colLocSecundarios === -1) colLocSecundarios = 6;
    if (colComportamentoLoc === -1) colComportamentoLoc = 7;
    if (colLocDesativar === -1) colLocDesativar = 8;
    if (colModeloNome === -1) colModeloNome = 9;
    if (colModeloCod === -1) colModeloCod = 10;
    if (colModeloGenerico === -1) colModeloGenerico = 11;
    if (colEvento === -1) colEvento = 12;
    if (colEventoCod === -1) colEventoCod = 13;
    if (colEventoComplementar === -1) colEventoComplementar = 14;
    if (colDadosComplementares === -1) colDadosComplementares = 15;
    if (colIntimar === -1) colIntimar = 16;
    if (colEvIntimar === -1) colEvIntimar = 17;
    if (colPzEsp === -1) colPzEsp = 18;
    if (colPzSimp === -1) colPzSimp = 19;
    if (colPzPartes === -1) colPzPartes = 20;
    if (colPzDPU === -1) colPzDPU = 21;
    if (colRemeter === -1) colRemeter = 22;
    if (colEvRemessa === -1) colEvRemessa = 23;
    if (colOrgaoRemessa === -1) colOrgaoRemessa = 24;
    if (colClassif === -1) colClassif = 25;
    if (colDesc === -1) colDesc = 26;



    const itens = [];

    for (let i = idxCab + 1; i < tabela.length; i++) {

      const r = tabela[i];

      const ferramenta = colFerramenta !== -1 ? (r[colFerramenta] || '').trim() : '';



      // REGRA: Ignorar preferências de categoria "Movimentar" na tela de Minutas

      if (normalizar(ferramenta).includes('movimentar')) {

        continue;

      }



      const nome = (r[colNome] || '').trim();

      if (!nome) continue;



      let locP = colLoc !== -1 ? (r[colLoc] || '').trim() : '';

      let locS = colLocSecundarios !== -1 ? (r[colLocSecundarios] || '').trim() : '';

      let localizadores = [];



      if (locP && locP !== '-') {

        const partesP = locP.split(';').map(s => s.trim()).filter(Boolean);

        localizadores.push(...partesP);

      }

      if (locS && locS !== '-') {

        const partesS = locS.split(';').map(s => s.trim()).filter(Boolean);

        localizadores.push(...partesS);

      }

      // [v3.5.6] Comportamento do Localizador e Localizadores a Desativar
      let compLocRaw = colComportamentoLoc !== -1 ? String(r[colComportamentoLoc] || '').trim() : '';
      let locDesativarRaw = colLocDesativar !== -1 ? String(r[colLocDesativar] || '').trim() : '';
      let localizadoresDesativar = [];
      if (locDesativarRaw && locDesativarRaw !== '-' && !normalizar(locDesativarRaw).includes('nao remover') && !normalizar(locDesativarRaw).includes('nenhum')) {
        localizadoresDesativar = locDesativarRaw.split(/[;,]/).map(s => s.trim()).filter(Boolean);
      }
      // [v3.5.6] No eproc minuta_cadastrar: '0' = Remover informado(s), '1' = Todos, '2' = Todos exceto sistema, '3' = Não remover
      let comportamentoCodigo = '3';
      const cNorm = normalizar(compLocRaw);
      if (cNorm.includes('todos') || cNorm === '1') {
        comportamentoCodigo = '1';
      } else if (cNorm.includes('selecionado') || cNorm.includes('remover') || cNorm === '0' || cNorm === '2' || localizadoresDesativar.length > 0) {
        comportamentoCodigo = '0';
      } else if (cNorm.includes('nao remover') || cNorm.includes('manter') || cNorm === '3') {
        comportamentoCodigo = '3';
      }



      const modeloNome = colModeloNome !== -1 ? (r[colModeloNome] || '').trim() : '';

      const modeloCod = colModeloCod !== -1 ? (r[colModeloCod] || '').trim() : '';

      const modeloGenerico = colModeloGenerico !== -1 ? (r[colModeloGenerico] || '').trim() : '';

      const evento = colEvento !== -1 ? (r[colEvento] || '').trim() : '';

      const eventoCod = colEventoCod !== -1 ? (r[colEventoCod] || '').trim() : '';

      const classificacao = colClassif !== -1 ? (r[colClassif] || '').trim() : '';

      const descricao = colDesc !== -1 ? (r[colDesc] || '').trim() : '';



      // Eventos Complementares

      let evCompBruto = colEventoComplementar !== -1 ? (r[colEventoComplementar] || '').trim() : '';

      let eventosComplementares = [];

      if (evCompBruto && evCompBruto !== '-') {

        eventosComplementares = evCompBruto.split(';').map(s => s.trim()).filter(Boolean);

      }



      // Dados Complementares

      let dcBruto = colDadosComplementares !== -1 ? (r[colDadosComplementares] || '').trim() : '';

      let dadosComplementaresPares = [];

      if (dcBruto && dcBruto !== '-') {

        dadosComplementaresPares = parseDadosComplementares(dcBruto);

      }



      // Dados de Intimação e Remessa (2G)

      const valIntimar = colIntimar !== -1 ? (r[colIntimar] || '') : '';

      const deveIntimar = normalizar(valIntimar).includes('sim') || normalizar(valIntimar) === 's';

      const evIntimar = colEvIntimar !== -1 ? (r[colEvIntimar] || '').trim() : '';

      const pzEsp = colPzEsp !== -1 ? (parseInt(r[colPzEsp], 10) || 30) : 30;

      const pzSimp = colPzSimp !== -1 ? (parseInt(r[colPzSimp], 10) || 15) : 15;

      const pzPartes = colPzPartes !== -1 ? (parseInt(r[colPzPartes], 10) || 15) : 15;

      const pzDPU = colPzDPU !== -1 ? (parseInt(r[colPzDPU], 10) || 30) : 30;



      const valRemeter = colRemeter !== -1 ? (r[colRemeter] || '') : '';

      const deveRemeter = normalizar(valRemeter).includes('sim') || normalizar(valRemeter) === 's';

      const evRemessa = colEvRemessa !== -1 ? (r[colEvRemessa] || '').trim() : '';

      const orgRemessa = colOrgaoRemessa !== -1 ? (r[colOrgaoRemessa] || '').trim() : '';

      const assinanteInd = colAssinante !== -1 ? (r[colAssinante] || '').trim() : '';

      const grupoPref = colGrupo !== -1 ? (r[colGrupo] || '').trim() : '';



      const rawNum = colNum !== -1 && r[colNum] ? String(r[colNum]).trim() : '';

      itens.push({
        num: rawNum || String(i),
        linha: i + 1,
        ferramenta: ferramenta,

        nome: nome,

        intimarPartes: deveIntimar,

        eventoIntimacao: evIntimar,

        prazoEspecial: pzEsp,

        prazoSimples: pzSimp,

        prazoPartes: pzPartes,

        prazoDPU: pzDPU,

        remeterProcesso: deveRemeter,

        eventoRemessa: evRemessa,

        orgaoRemessa: orgRemessa,

        grupo: grupoPref,

        assinanteIndicado: assinanteInd,

        modeloNome: modeloNome,

        modeloCod: modeloCod,

        modeloGenericoFixo: modeloGenerico,

        evento: evento,

        eventoCod: eventoCod,

        eventosComplementares: eventosComplementares,

        dadosComplementaresPares: dadosComplementaresPares,

        localizadores: localizadores,

        classificacao: classificacao,

        descricao: descricao,
        comportamentoLocalizador: comportamentoCodigo,
        comportamentoLocalizadorTexto: compLocRaw,
        localizadoresDesativar: localizadoresDesativar,
        locDesativarRaw: locDesativarRaw,

      });

    }



    return itens;

  }



  function lerTextoDelimitado(texto) {

    const linhas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    if (!linhas.length) return [];

    let sep = '\t';

    if (linhas[0].includes(';') && !linhas[0].includes('\t')) sep = ';';

    const tabela = linhas.map(l => {

      const parts = l.split(sep);

      const d = {};

      parts.forEach((p, idx) => { d[idx] = p.trim().replace(/^["']|["']$/g, ''); });

      return d;

    });

    return converterTabelaParaItens(tabela);

  }



  /* ================== DISPARADORES DE EVENTOS ================== */

  function dispararEventos(el, tipos = ['input', 'change']) {

    if (!el) return;

    tipos.forEach(tipo => {

      try {

        const ev = new Event(tipo, { bubbles: true, cancelable: true });

        el.dispatchEvent(ev);

      } catch (e) {

        try {

          const ev = document.createEvent('HTMLEvents');

          ev.initEvent(tipo, true, true);

          el.dispatchEvent(ev);

        } catch (err) {}

      }

    });

  }



  function dispararClique(el) {

    if (!el) return;

    ['mousedown', 'mouseup', 'click'].forEach(t => {

      try {

        el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }));

      } catch (e) {

        el.click();

      }

    });

  }



  /* ================== DESTAQUE FLUORESCENTE NO CAMPO ATIVO & TOOLTIP AO VIVO ================== */

  let tooltipLiveDataEl = null;



  function obterTooltipLiveData() {

    if (!tooltipLiveDataEl || !document.body.contains(tooltipLiveDataEl)) {

      tooltipLiveDataEl = document.getElementById('eproc-tooltip-live-data');

      if (!tooltipLiveDataEl) {

        tooltipLiveDataEl = document.createElement('div');

        tooltipLiveDataEl.id = 'eproc-tooltip-live-data';

        (document.body || document.documentElement).appendChild(tooltipLiveDataEl);

      }

    }

    return tooltipLiveDataEl;

  }



  function destacarCampoAtivo(elemento, rotuloPasso, valorPlanilha) {

    try {

      removerDestaqueCampo();

      if (!elemento) return;



      elemento.classList.add('eproc-campo-destaque-neon');



      // Scroll inteligente se o campo estiver fora do campo de visualização

      if (typeof elemento.scrollIntoViewIfNeeded === 'function') {

        elemento.scrollIntoViewIfNeeded(false);

      } else if (typeof elemento.scrollIntoView === 'function') {

        elemento.scrollIntoView({ behavior: 'auto', block: 'nearest' });

      }



      const tooltip = obterTooltipLiveData();

      if (!tooltip) return;



      const valStr = (valorPlanilha !== undefined && valorPlanilha !== null) ? String(valorPlanilha).trim() : '';

      const valExibicao = valStr.length > 75 ? (valStr.substring(0, 72) + '...') : (valStr || '(Em branco)');



      tooltip.textContent = '';

      const textSpan = document.createElement('span');

      textSpan.textContent = valExibicao;

      tooltip.appendChild(textSpan);



      const rect = elemento.getBoundingClientRect();

      const scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;

      const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;



      let top = rect.top + scrollY - 26;

      if (rect.top < 35) {

        top = rect.bottom + scrollY + 4;

      }

      let left = rect.left + scrollX;

      if (left + 420 > (window.innerWidth + scrollX)) {

        left = Math.max(scrollX + 10, window.innerWidth + scrollX - 440);

      }



      tooltip.style.top = `${Math.max(0, top)}px`;

      tooltip.style.left = `${Math.max(0, left)}px`;

      tooltip.style.display = 'block';

      tooltip.classList.add('visivel');

    } catch (e) {

      // Totalmente silencioso para garantir estabilidade máxima

    }

  }



  function removerDestaqueCampo() {

    try {

      const destacados = document.querySelectorAll('.eproc-campo-destaque-neon');

      destacados.forEach(el => el.classList.remove('eproc-campo-destaque-neon'));



      if (tooltipLiveDataEl) {

        tooltipLiveDataEl.classList.remove('visivel');

        tooltipLiveDataEl.style.display = 'none';

      }

    } catch (e) {}

  }



  /* ================== SELEÇÃO DE MODELO ================== */

  async function esperarMenuAutocomplete(divId, maxMs = 2500) {

    const ini = Date.now();

    while (Date.now() - ini < maxMs) {

      if (window._eprocPararLote) break;

      const lis = document.querySelectorAll(`#${divId} li`);

      if (lis.length > 0) return lis;

      await sleep(150);

    }

    return document.querySelectorAll(`#${divId} li`);

  }



  async function executarBuscaModeloEObterItens(termo) {

    const txtModelo = document.getElementById('txtModelo');

    txtModelo.focus();

    txtModelo.value = termo;

    dispararEventos(txtModelo, ['input', 'keydown', 'keyup', 'change']);



    if (window.objAjaxModelo && typeof window.objAjaxModelo.executar === 'function') {

      try { window.objAjaxModelo.executar(); } catch (e) {}

    }



    const lis = await esperarMenuAutocomplete('divInfraAjaxtxtModelo', 2500);

    const itensAjax = (window.objAjaxModelo && window.objAjaxModelo.arrItens) ? window.objAjaxModelo.arrItens : [];

    return { lis, itensAjax };

  }



  async function aplicarSelecaoModelo(idxEscolhido, itensAjax, lis) {

    const txtModelo = document.getElementById('txtModelo');

    const hdnIdModelo = document.getElementById('hdnIdModelo');

    const m = itensAjax[idxEscolhido];

    if (!m) return false;



    const idReal = m.id.split('|')[0];



    if (window.objAjaxModelo && typeof window.objAjaxModelo.escolher === 'function') {

      try { window.objAjaxModelo.escolher(idxEscolhido); } catch (e) {}

    } else if (typeof window.objAjaxModeloProcessarResultado === 'function') {

      try { window.objAjaxModeloProcessarResultado(m.id, m.descricao, m.complemento || 'null', ''); } catch (e) {}

    }



    if (lis && lis[idxEscolhido]) {

      try { dispararClique(lis[idxEscolhido]); } catch (e) {}

    }



    // Força preenchimento de todos os campos do modelo no DOM

    hdnIdModelo.value = idReal;

    const hdnTxt = document.getElementById('hdnTxtModelo');

    if (hdnTxt) hdnTxt.value = m.descricao;

    const hdnMatriz = document.getElementById('hdnIdModeloMatrizModeloPadrao');

    if (hdnMatriz) hdnMatriz.value = m.id;

    txtModelo.value = m.descricao.replace(/^\*\*\*\s*|\s*\*\*\*$/g, '');

    dispararEventos(txtModelo, ['input', 'change', 'blur']);



    // Reconfigura o assinante nativo

    if (typeof window.montarAssinante === 'function') {

      try {

        const idAss = window.jQuery ? window.jQuery('#selAssinante').val() : '';

        const idTrat = window.jQuery ? window.jQuery('#selTratamento').val() : '';

        window.montarAssinante(idAss, idTrat, window.mc_numIdMagistrado);

      } catch (e) {}

    }



    await sleep(250);

    addLog(`✅ Modelo selecionado: "${m.descricao}" (ID: ${idReal})`);

    return true;

  }



  /* ================== LIMPEZA PROFUNDA DO FORMULÁRIO ================== */

  function resetarFormularioCompletamente() {

    removerDestaqueCampo();

    try {

      // 1. Nome da preferência

      const txtPref = document.getElementById('txtPreferencia');

      const hdnIdPref = document.getElementById('hdnIdPreferencia');

      if (txtPref) { txtPref.value = ''; dispararEventos(txtPref, ['input', 'change']); }

      if (hdnIdPref) hdnIdPref.value = '';



      // 2. Modelo de Documento

      const txtModelo = document.getElementById('txtModelo');

      const hdnIdModelo = document.getElementById('hdnIdModelo');

      const hdnTxtModelo = document.getElementById('hdnTxtModelo');

      const hdnMatriz = document.getElementById('hdnIdModeloMatrizModeloPadrao');

      const txtModPadrao = document.getElementById('txtModeloPadrao');

      const hdnModPadrao = document.getElementById('hdnModeloPadrao');

      const hdnIdModPadrao = document.getElementById('hdnIdModeloPadrao');

      if (txtModelo) { txtModelo.value = ''; dispararEventos(txtModelo, ['input', 'change']); }

      if (hdnIdModelo) hdnIdModelo.value = '';

      if (hdnTxtModelo) hdnTxtModelo.value = '';

      if (hdnMatriz) hdnMatriz.value = '';

      if (txtModPadrao) txtModPadrao.value = '';

      if (hdnModPadrao) hdnModPadrao.value = '';

      if (hdnIdModPadrao) hdnIdModPadrao.value = '';

      const divMenuMod = document.getElementById('divInfraAjaxtxtModelo');

      if (divMenuMod) divMenuMod.style.display = 'none';



      // 3. Agendamento e Evento

      const chkAgend = document.getElementById('chkEventoAgendamento');

      if (chkAgend && chkAgend.checked) {

        chkAgend.checked = false;

        dispararEventos(chkAgend, ['change', 'click']);

        if (typeof window.marcarAgendamento === 'function') {

          try { window.marcarAgendamento(); } catch (e) {}

        }

      }

      const txtEvento = document.getElementById('txtEvento');

      const hdnEvento = document.getElementById('hdnEvento');

      if (txtEvento) { txtEvento.value = ''; dispararEventos(txtEvento, ['input', 'change']); }

      if (hdnEvento) hdnEvento.value = '';

      const divMenuEv = document.getElementById('divInfraAjaxtxtEvento');

      if (divMenuEv) divMenuEv.style.display = 'none';



      // Limpeza de Eventos Complementares

      limparEventosComplementares();

      const divEvComp = document.getElementById('divEventosComplementares');

      if (divEvComp) divEvComp.style.display = 'none';



      // Limpeza de Dados de Autuação e Dados Complementares

      limparDadosComplementares();



      // 4. Localizadores Secundários e Principal

      const chkSec = document.getElementById('chkLocalizadoresSecundarios');

      const selSec = document.getElementById('selLocalizadorSecundario');

      if (chkSec && chkSec.checked) {

        chkSec.checked = false;

        dispararEventos(chkSec, ['change', 'click']);

        if (typeof window.chkLocalizadoresSecundariosOnClick === 'function') {

          try { window.chkLocalizadoresSecundariosOnClick(chkSec); } catch (e) {}

        }

      }

      if (selSec) {

        Array.from(selSec.options).forEach(opt => opt.selected = false);

        if (window.jQuery && window.jQuery(selSec).multipleSelect) {

          try {

            window.jQuery(selSec).multipleSelect('uncheckAll');

            window.jQuery(selSec).multipleSelect('setSelects', []);

            window.jQuery(selSec).multipleSelect('refresh');

          } catch (e) {}

        }

        const drop = document.getElementById('ms-drop-selLocalizadorSecundario');

        if (drop) {

          drop.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = false);

        }

        dispararEventos(selSec, ['change']);

      }



      const selNovo = document.getElementById('selNovoLocalizador') || document.getElementById('selLocalizador');

      if (selNovo) {

        selNovo.value = 'null';


      // [v3.5.6] Reset de Comportamento de Localizador e Localizadores a Desativar
      const selOpcaoLocReset = document.getElementById('selOpcaoLocalizador');
      if (selOpcaoLocReset) {
        selOpcaoLocReset.value = '3';
        dispararEventos(selOpcaoLocReset, ['change']);
      }
      const selDesativarReset = document.getElementById('selLocalizadorDesativar');
      if (selDesativarReset) {
        Array.from(selDesativarReset.options).forEach(o => { o.selected = false; o.removeAttribute('selected'); });
        if (window.$) {
          try { window.$('#selLocalizadorDesativar option').prop('selected', false); } catch (e) {}
        }
      }
      window._eprocMinutaLocsDesativar = null;
      window._eprocMinutaComportamentoLoc = null;
        dispararEventos(selNovo, ['change']);

      }



      // 5. Classificação e Descrição

      const elClassif = document.getElementById('selClassificacaoConteudo') || document.getElementById('selClassificacaoConteudoIds');

      if (elClassif) {

        elClassif.value = '';

        if (window.jQuery && window.jQuery(elClassif).select2) {

          try { window.jQuery(elClassif).select2('data', null); } catch (e) {}

        }

        dispararEventos(elClassif, ['change']);

      }

      const elDesc = document.getElementById('txtDescricao');

      if (elDesc) { elDesc.value = ''; dispararEventos(elDesc, ['input', 'change']); }



      // 6. Urgência do Mandado CEMAN

      const selUrg = document.getElementById('selTipoUrgencia');

      if (selUrg) {

        selUrg.selectedIndex = 0;

        dispararEventos(selUrg, ['change']);

      }



      // 7. Assinante e Status Minuta

      const selAssinante = document.getElementById('selAssinante');

      if (selAssinante) {

        selAssinante.selectedIndex = 0;

        dispararEventos(selAssinante, ['change']);

      }

      const selStatus = document.getElementById('selStatusMinuta');

      if (selStatus) {

        selStatus.selectedIndex = 0;

        dispararEventos(selStatus, ['change']);

      }

    } catch (e) {

      console.warn('Erro ao resetar formulário:', e);

    }

  }



  /* ================== MOTOR DE MATCH INTELIGENTE PARA MODELOS ================== */

  const cacheModelosPorTermo = {};

  const poolGlobalModelos = new Map(); // id -> { id, descricao, complemento }



  function decodificarTextoItemAjax(str) {

    if (!str) return '';

    let s = decodeEntities(String(str).trim());

    if (/%[0-9A-Fa-f]{2}/.test(s)) {

      try {

        s = decodeURIComponent(s);

      } catch (e) {

        try { s = unescape(s); } catch (e2) {}

      }

    }

    return s.trim();

  }



  function registrarModelosNoPool(lista) {

    if (!Array.isArray(lista)) return;

    for (const m of lista) {

      if (m && m.id && m.descricao) {

        poolGlobalModelos.set(String(m.id).trim(), {

          id: String(m.id).trim(),

          descricao: decodificarTextoItemAjax(m.descricao),

          complemento: decodificarTextoItemAjax(m.complemento || '')

        });

      }

    }

  }



  // Codifica exatamente como a função nativa infraAjaxPost do InfraAjax.js do eproc

  function montarBodyParticulaInfraAjax(termo) {

    let post = 'particula=' + termo;

    post = encodeURIComponent(post);

    post = post.replace(/%26/g, '&');

    post = post.replace(/%3D/g, '=');

    post = post.replace(/%20/g, ' ');

    return post;

  }



  async function obterModelosPorTermo(termoBusca) {

    const raw = (termoBusca || 'DESP').trim();

    if (!raw) return [];

    const chaveCache = raw.toUpperCase();

    if (cacheModelosPorTermo[chaveCache] && cacheModelosPorTermo[chaveCache].length > 0) {

      return cacheModelosPorTermo[chaveCache];

    }



    const mapaItens = new Map();

    const url = (window.objAjaxModelo && (window.objAjaxModelo.ajaxTarget || window.objAjaxModelo.urlServico)) || window.mc_strLinkAjaxModelo;



    const termosGenericosPuros = new Set([

      '*', '***', 'DESP', 'DESPACHO', 'DECIS', 'SENTEN', 'SENTENCA', 'SENTENÇA',

      'ATO', 'MANDAD', 'MANDADO', 'CARTA', 'PRECAT', 'PRECATORIA', 'PRECATÓRIA',

      'CERTID', 'CERTIDAO', 'CERTIDÃO'

    ]);

    const ehBuscaEspecifica = !raw.startsWith('*') && !termosGenericosPuros.has(chaveCache);

    const temModeloEspecificoNoMapa = () => Array.from(mapaItens.values()).some(m => m && m.descricao && !m.descricao.startsWith('***'));



    if (url) {

      const termosParaTentar = [raw];

      const emMaiusculo = raw.toUpperCase();

      if (emMaiusculo !== raw) termosParaTentar.push(emMaiusculo);

      const semAcento = normalizar(raw).toUpperCase();

      if (semAcento !== raw && semAcento !== emMaiusculo) termosParaTentar.push(semAcento);



      for (const t of termosParaTentar) {

        if (ehBuscaEspecifica ? temModeloEspecificoNoMapa() : mapaItens.size > 0) break;



        const bodiesParaTentar = [

          montarBodyParticulaInfraAjax(t),

          'particula=' + encodeURIComponent(t)

        ];

        if (/[^\x00-\x7F]/.test(t)) {

          bodiesParaTentar.push('particula=' + codificarParticula(t, true));

        }

        const bodiesUnicos = Array.from(new Set(bodiesParaTentar));



        for (const bodyStr of bodiesUnicos) {

          if (ehBuscaEspecifica ? temModeloEspecificoNoMapa() : mapaItens.size > 0) break;

          try {

            const resp = await fetch(url, {

              method: 'POST',

              headers: {

                'Content-Type': 'application/x-www-form-urlencoded'

              },

              body: bodyStr,

              credentials: 'same-origin'

            });

            if (resp.ok) {

              const txt = await lerRespostaTexto(resp);

              const parser = new DOMParser();

              const xml = parser.parseFromString(txt, 'text/xml');

              xml.querySelectorAll('item').forEach(it => {

                const id = (it.getAttribute('id') || '').trim();

                const desc = decodificarTextoItemAjax(it.getAttribute('descricao') || it.textContent || '');

                const compl = decodificarTextoItemAjax(it.getAttribute('complemento') || '');

                if (id && desc) {

                  mapaItens.set(id, { id, descricao: desc, complemento: compl });

                }

              });



              const reTag = /<item\b([^>]*)\/?>/gi;

              let mTag;

              while ((mTag = reTag.exec(txt)) !== null) {

                const attrs = mTag[1] || '';

                const mId = attrs.match(/\bid=["']([^"']+)["']/i);

                const mDesc = attrs.match(/\bdescricao=["']([^"']+)["']/i);

                const mCompl = attrs.match(/\bcomplemento=["']([^"']*)["']/i);

                if (mId && mDesc) {

                  const id = mId[1].trim();

                  const desc = decodificarTextoItemAjax(mDesc[1]);

                  const compl = mCompl ? decodificarTextoItemAjax(mCompl[1]) : '';

                  if (id && desc && !mapaItens.has(id)) {

                    mapaItens.set(id, { id, descricao: desc, complemento: compl });

                  }

                }

              }

            }

          } catch (e) {

            console.warn('Erro ao consultar modelos via fetch para termo ' + t, e);

          }

        }

      }

    }



    const lista = Array.from(mapaItens.values());

    if (lista.length > 0) {

      cacheModelosPorTermo[chaveCache] = lista;

      registrarModelosNoPool(lista);

    }



    return lista;

  }



  function codificarParticula(termo, latin1) {

    if (!latin1) return encodeURIComponent(termo);

    return Array.from(termo).map(ch => {

      const c = ch.charCodeAt(0);

      if (c < 128) return encodeURIComponent(ch);

      if (c < 256) return '%' + c.toString(16).toUpperCase().padStart(2, '0');

      return encodeURIComponent(ch);

    }).join('');

  }



  async function lerRespostaTexto(resp) {

    const buf = await resp.arrayBuffer();

    try {

      return new TextDecoder('utf-8', { fatal: true }).decode(buf);

    } catch (e) {

      return new TextDecoder('windows-1252').decode(buf);

    }

  }



  // Padroniza eventual prefixo "Decisão/Despacho -" para "Despacho/Decisão -"

  function padronizarPrefixoTipoModelo(nome) {

    if (!nome) return '';

    return String(nome)

      .trim()

      .replace(/^decis[aã]o\s*\/\s*despacho\s*[-–—]\s*/i, 'Despacho/Decisão - ')

      .replace(/\s*\(sgs\d+\)\s*/gi, ' ')

      .replace(/\s*[-–—]\s*\d{6,}\s*$/g, '')

      .replace(/\s+/g, ' ')

      .trim();

  }



  // Extrai termos de busca iniciando pelo nome completo exato da coluna Modelo Específico (Nome) (que começa pelo Tipo de Documento)

  function extrairTermosBuscaModelo(item) {

    const termos = new Set();

    const nomeBruto = String(item.modeloNome || '').trim();

    if (nomeBruto && nomeBruto !== '-') {

      const nomePadrao = padronizarPrefixoTipoModelo(nomeBruto);

      if (nomePadrao) {

        // 1. Nome completo exato iniciando pelo Tipo de Documento (ex.: "Ato Ordinatório - JEC_PR - ...")

        termos.add(nomePadrao);



        // 2. Nome completo com Tipo de Documento, porém sem parênteses finais (ex.: "(Art. 265 CPC)")

        const semParens = nomePadrao.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();

        if (semParens && semParens !== nomePadrao) {

          termos.add(semParens);

        }



        // 3. Fallback sem o prefixo do Tipo de Documento (caso algum modelo isolado na Vara tenha sido cadastrado sem o tipo no início)

        const semTipo = semParens

          .replace(/^(despacho\/decis[aã]o|despacho\/of[ií]cio|despacho|decis[aã]o|senten[cç]a|ato ordinat[oó]rio|ato|mandado - ceman|mandado|carta ar digital|carta precat[oó]ria|carta|certid[aã]o de cart[oó]rio|certid[aã]o|ceman)\s*[-–—]\s*/gi, '')

          .trim();

        if (semTipo && semTipo !== semParens) {

          termos.add(semTipo);

        }

      }

    }



    const cod = String(item.modeloCod || '').trim();

    if (/^\d{6,}$/.test(cod)) {

      termos.add(cod);

    }



    return Array.from(termos).filter(t => t && t.length >= 3);

  }



  // Reúne modelos candidatos de um item consultando o eproc pelo nome completo do modelo (parando assim que encontrar o modelo específico)

  async function mesclarModelosEspecificos(item, baseLista) {

    const mapa = new Map();

    (baseLista || []).forEach(m => { if (m && m.id) mapa.set(m.id, m); });

    poolGlobalModelos.forEach((v, k) => { if (!mapa.has(k)) mapa.set(k, v); });



    // Se o modelo específico já está no pool global, retorna imediatamente sem novas requisições

    if (localizarMelhorModeloEspecifico(item, Array.from(mapa.values()))) {

      return Array.from(mapa.values());

    }



    const termos = extrairTermosBuscaModelo(item);

    for (const tm of termos) {

      const l = await obterModelosPorTermo(tm);

      (l || []).forEach(m => {

        if (m && m.id && !mapa.has(m.id)) mapa.set(m.id, m);

      });

      // Assim que o modelo específico for localizado (ex.: logo no 1º termo com nome completo), encerra as buscas adicionais

      if (localizarMelhorModeloEspecifico(item, Array.from(mapa.values()))) {

        break;

      }

    }



    return Array.from(mapa.values());

  }



  // Varredura dos modelos da Unidade baseada diretamente nos nomes completos da coluna Modelo Específico (Nome) e nas 7 matrizes genéricas

  async function escanearModelosDaUnidade(itens, onProgress) {

    const url = (window.objAjaxModelo && (window.objAjaxModelo.ajaxTarget || window.objAjaxModelo.urlServico)) || window.mc_strLinkAjaxModelo;

    if (url) {

      try {

        if (typeof onProgress === 'function') {

          onProgress(1, 10, 'Consultando lista geral da Unidade (Listar Todos)...');

        }

        const respGet = await fetch(url, { method: 'GET', credentials: 'same-origin' });

        if (respGet.ok) {

          const txtGet = await lerRespostaTexto(respGet);

          const listaGet = [];

          const reTag = /<item\b([^>]*)\/?>/gi;

          let mTag;

          while ((mTag = reTag.exec(txtGet)) !== null) {

            const attrs = mTag[1] || '';

            const mId = attrs.match(/\bid=["']([^"']+)["']/i);

            const mDesc = attrs.match(/\bdescricao=["']([^"']+)["']/i);

            const mCompl = attrs.match(/\bcomplemento=["']([^"']*)["']/i);

            if (mId && mDesc) {

              const id = mId[1].trim();

              const desc = decodificarTextoItemAjax(mDesc[1]);

              const compl = mCompl ? decodificarTextoItemAjax(mCompl[1]) : '';

              if (id && desc) listaGet.push({ id, descricao: desc, complemento: compl });

            }

          }

          if (listaGet.length > 0) registrarModelosNoPool(listaGet);

        }

      } catch (e) {}

    }



    const termosMatrizes = [

      '***',

      'DESPACHO',

      'ACORDAO',

      'ATO',

      'MANDADO',

      'CARTA',

      'PRECATORIA',

      'CERTIDAO'

    ];



    const itensUnicos = [];

    if (Array.isArray(itens)) {

      const nomesJaConsultados = new Set();

      for (const it of itens) {

        if (it && it.modeloNome && it.modeloNome !== '-') {

          const chaveMod = padronizarPrefixoTipoModelo(it.modeloNome).toUpperCase();

          if (chaveMod && !nomesJaConsultados.has(chaveMod)) {

            nomesJaConsultados.add(chaveMod);

            itensUnicos.push(it);

          }

        }

      }

    }



    const totalPassos = termosMatrizes.length + itensUnicos.length;

    let passoAtual = 0;



    for (const tb of termosMatrizes) {

      passoAtual++;

      if (typeof onProgress === 'function') {

        onProgress(passoAtual, totalPassos, `Matriz base: ${tb}`);

      }

      await obterModelosPorTermo(tb);

    }



    for (let i = 0; i < itensUnicos.length; i++) {

      const it = itensUnicos[i];

      passoAtual++;

      if (typeof onProgress === 'function') {

        onProgress(passoAtual, totalPassos, `Modelo (${i + 1}/${itensUnicos.length}): ${padronizarPrefixoTipoModelo(it.modeloNome)}`);

      }

      await mesclarModelosEspecificos(it, []);

    }

  }



  // Normalizador de modelo para comparação de alta precisão (com e sem prefixo de Tipo de Documento)

  function limparModeloParaComparacao(str) {

    if (!str) {

      return {

        rawLimpo: '',

        normComTipo: '',

        normComTipoSemArtigos: '',

        normSemTipo: '',

        normSemTipoSemArtigos: ''

      };

    }

    let s = padronizarPrefixoTipoModelo(str);

    s = s.replace(/\*+/g, '');

    s = s.replace(/\(sgs\d+\)/gi, '');

    s = s.replace(/\(m\d+\)/gi, '');

    s = s.replace(/\s*[-–—]\s*\d{6,}\s*$/g, '');

    s = s.replace(/\d{10,}\s*$/g, '');



    const comTipoSemArtigos = s.replace(/\(art\.?[^)]*\)/gi, '').replace(/\([^)]*\)/g, '').trim();



    let semTipo = s.replace(/^(despacho\/decis[aã]o|despacho\/of[ií]cio|despacho|decis[aã]o|senten[cç]a|ato ordinat[oó]rio|ato|mandado - ceman|mandado|carta ar digital|carta precat[oó]ria|carta|certid[aã]o de cart[oó]rio|certid[aã]o|ceman)\s*[-–—]\s*/gi, '').trim();

    semTipo = semTipo.replace(/^(despacho\/of[ií]cio|ceman|carta precat[oó]ria)\s*[-–—]\s*/gi, '').trim();

    const semTipoSemArtigos = semTipo.replace(/\(art\.?[^)]*\)/gi, '').replace(/\([^)]*\)/g, '').trim();



    return {

      rawLimpo: s.trim(),

      normComTipo: normalizar(s),

      normComTipoSemArtigos: normalizar(comTipoSemArtigos),

      normSemTipo: normalizar(semTipo),

      normSemTipoSemArtigos: normalizar(semTipoSemArtigos)

    };

  }



  /* ================== LOCALIZADOR INTELIGENTE DE MODELO ESPECÍFICO ================== */

  function localizarMelhorModeloEspecifico(item, listaModelos) {

    const todosModelos = new Map();

    if (Array.isArray(listaModelos)) {

      listaModelos.forEach(m => { if (m && m.id) todosModelos.set(m.id, m); });

    }

    poolGlobalModelos.forEach((v, k) => { if (!todosModelos.has(k)) todosModelos.set(k, v); });



    const candidatos = Array.from(todosModelos.values()).filter(m => m && m.descricao && !m.descricao.startsWith('***') && !ehNomeModeloGenerico(m.descricao));

    if (candidatos.length === 0) return null;



    const rawNome = (item.modeloNome || '').trim();

    if (!rawNome || rawNome === '-' || rawNome.startsWith('***') || rawNome.endsWith('***') || ehNomeModeloGenerico(rawNome)) {

      return null;

    }



    const infoAlvo = limparModeloParaComparacao(rawNome);

    if (!infoAlvo.normComTipo && !infoAlvo.normSemTipo) return null;



    const alvoTemMle = infoAlvo.normComTipo.includes('mle');



    // 1. Correspondência exata pelo nome completo (Tipo de Documento + Nome do Modelo)

    for (const c of candidatos) {

      const infoC = limparModeloParaComparacao(c.descricao);

      if (infoC.normComTipo.includes('mle') !== alvoTemMle) continue;

      if (infoC.normComTipo && infoC.normComTipo === infoAlvo.normComTipo) {

        return c;

      }

    }



    // 2. Correspondência exata pelo nome completo (Tipo de Documento + Nome), ignorando parênteses de artigos e tags (SGS...)

    for (const c of candidatos) {

      const infoC = limparModeloParaComparacao(c.descricao);

      if (infoC.normComTipo.includes('mle') !== alvoTemMle) continue;

      if (infoC.normComTipoSemArtigos && infoC.normComTipoSemArtigos === infoAlvo.normComTipoSemArtigos) {

        return c;

      }

    }



    // 3. Correspondência direta por Código do Modelo (em id, descricao ou complemento)

    const codEsp = String(item.modeloCod || '').trim();

    if (/^\d{6,}$/.test(codEsp)) {

      const porCod = candidatos.find(m => {

        const infoC = limparModeloParaComparacao(m.descricao);

        if (infoC.normComTipo.includes('mle') !== alvoTemMle) return false;

        const idStr = String(m.id || '');

        const descStr = String(m.descricao || '');

        const complStr = String(m.complemento || '');

        return idStr.includes(codEsp) || descStr.includes(codEsp) || complStr.includes(codEsp);

      });

      if (porCod) return porCod;

    }



    // 4. Correspondência exata sem o prefixo do Tipo de Documento (para modelos cadastrados na Vara sem o tipo no início)

    for (const c of candidatos) {

      const infoC = limparModeloParaComparacao(c.descricao);

      if (infoC.normComTipo.includes('mle') !== alvoTemMle) continue;

      if (infoC.normSemTipo && infoC.normSemTipo === infoAlvo.normSemTipo) {

        return c;

      }

      if (infoC.normSemTipoSemArtigos && infoC.normSemTipoSemArtigos === infoAlvo.normSemTipoSemArtigos) {

        return c;

      }

    }



    // 5. Inclusão estrita com mesmo Tipo de Documento e mesma regra de MLE

    for (const c of candidatos) {

      const infoC = limparModeloParaComparacao(c.descricao);

      if (infoC.normComTipo.includes('mle') !== alvoTemMle) continue;

      if (infoAlvo.normComTipoSemArtigos && infoC.normComTipoSemArtigos) {

        if (infoC.normComTipoSemArtigos.includes(infoAlvo.normComTipoSemArtigos) || infoAlvo.normComTipoSemArtigos.includes(infoC.normComTipoSemArtigos)) {

          return c;

        }

      }

    }



    // Se não encontrou o modelo exato na unidade, retorna null para acionar automaticamente a Matriz Genérica (Fallback)

    return null;

  }



  async function aplicarSelecaoModeloObjeto(m) {

    if (!m) return false;

    const txtModelo = document.getElementById('txtModelo');

    const hdnIdModelo = document.getElementById('hdnIdModelo');

    if (!txtModelo || !hdnIdModelo) return false;



    const arrId = String(m.id || '').split('|');

    const idMatriz = arrId[0];

    const idModeloPadrao = arrId[1] || '';

    const codModeloPadrao = arrId[2] || (m.complemento && m.complemento !== 'null' ? m.complemento : '');



    // Atualiza campos do DOM

    hdnIdModelo.value = idMatriz;

    const hdnTxt = document.getElementById('hdnTxtModelo');

    if (hdnTxt) hdnTxt.value = m.descricao;

    const hdnMatriz = document.getElementById('hdnIdModeloMatrizModeloPadrao');

    if (hdnMatriz) hdnMatriz.value = m.id;



    const txtModPadrao = document.getElementById('txtModeloPadrao');

    if (txtModPadrao) txtModPadrao.value = codModeloPadrao;

    const hdnModPadrao = document.getElementById('hdnModeloPadrao');

    if (hdnModPadrao) hdnModPadrao.value = idModeloPadrao;

    const hdnIdModPadrao = document.getElementById('hdnIdModeloPadrao');

    if (hdnIdModPadrao) hdnIdModPadrao.value = idModeloPadrao;



    txtModelo.value = m.descricao.replace(/^\*\*\*\s*|\s*\*\*\*$/g, '');

    dispararEventos(txtModelo, ['input', 'change', 'blur']);



    // Chama handlers nativos do eproc

    if (window.objAjaxModelo && typeof window.objAjaxModelo.selecionar === 'function') {

      try { window.objAjaxModelo.selecionar(m.id, m.descricao, m.complemento || 'null'); } catch (e) {}

    } else if (window.objAjaxModelo && typeof window.objAjaxModelo.processarResultado === 'function') {

      try { window.objAjaxModelo.processarResultado(m.id, m.descricao, m.complemento || 'null'); } catch (e) {}

    } else if (typeof window.objAjaxModeloProcessarResultado === 'function') {

      try { window.objAjaxModeloProcessarResultado(m.id, m.descricao, m.complemento || 'null', ''); } catch (e) {}

    }



    // Reconfigura assinante nativo

    if (typeof window.montarAssinante === 'function') {

      try {

        const idAss = window.jQuery ? window.jQuery('#selAssinante').val() : '';

        const idTrat = window.jQuery ? window.jQuery('#selTratamento').val() : '';

        window.montarAssinante(idAss, idTrat, window.mc_numIdMagistrado);

      } catch (e) {}

    }



    await sleep(200);

    addLog(`✓ Modelo selecionado: "${m.descricao}" (ID: ${idMatriz})`);

    return true;

  }



  /* ================== IDENTIFICAÇÃO DE MATRIZES GENÉRICAS (COM ASTERISCOS E ESPAÇOS) ================== */

  function identificarMatrizGenerica(listaModelos, chave) {

    if (!Array.isArray(listaModelos) || listaModelos.length === 0) return null;

    const alias = { senten: 'sentenca', precator: 'precatoria', certid: 'certidao' };

    let ch = (chave || '').toLowerCase().trim();

    ch = alias[ch] || ch;



    const norm = m => normalizar((m.descricao || '').replace(/\uFFFD/g, ''));



    // Tratamento estrito e prioritário para DESPACHO / DECISÃO

    if (ch === 'despacho') {

      // 1. Modelos com asteriscos que contenham despacho ou decisao (ex: *** DESPACHO/DECISÃO ***)

      const comAst = listaModelos.filter(m => (m.descricao || '').includes('*'));

      const achouAst = comAst.find(m => {

        const d = norm(m);

        return (d.includes('despacho') || d.includes('decis')) &&

               !d.includes('representativo') && !d.includes('controversia') &&

               !d.includes('agravo') && !d.includes('recurso');

      });

      if (achouAst) return achouAst;



      // 2. Modelo cujo nome limpo é exatamente "despacho/decisao", "despacho / decisao", "decisao/despacho"

      const matchExato = listaModelos.find(m => {

        const d = norm(m).replace(/[\*\s\-\/]/g, '');

        return d === 'despachodecisao' || d === 'decisaodespacho';

      });

      if (matchExato) return matchExato;



      // 3. Modelo que contenha despacho e decisao sem palavras espúrias

      const matchAmbos = listaModelos.find(m => {

        const d = norm(m);

        return d.includes('despacho') && d.includes('decis') &&

               !d.includes('representativo') && !d.includes('controversia') &&

               !d.includes('agravo') && !d.includes('recurso');

      });

      if (matchAmbos) return matchAmbos;



      // 4. Modelo cujo nome é estritamente 'despacho' ou 'decisao'

      const matchPuro = listaModelos.find(m => {

        const d = norm(m).replace(/[\*\s\-_]/g, '');

        return (d === 'despacho' || d === 'decisao') && !d.includes('representativo') && !d.includes('controversia');

      });

      if (matchPuro) return matchPuro;



      // 5. Começa com despacho ou decisao, mas EXCLUI TERMINANTEMENTE representativo de controvérsia

      const matchInicio = listaModelos.find(m => {

        const d = norm(m);

        return (d.startsWith('despacho') || d.startsWith('decis')) &&

               !d.includes('representativo') &&

               !d.includes('controversia') &&

               !d.includes('agravo') &&

               !d.includes('recurso') &&

               !d.includes('embargos') &&

               !d.includes('saneador');

      });

      if (matchInicio) return matchInicio;



      return null;

    }



    // Tratamento estrito para ATO ORDINATÓRIO

    if (ch === 'ato') {

      const comAst = listaModelos.filter(m => (m.descricao || '').includes('*'));

      const achouAst = comAst.find(m => norm(m).includes('ato'));

      if (achouAst) return achouAst;

      const matchAto = listaModelos.find(m => {

        const d = norm(m);

        return d.includes('ato') && (d.includes('ordinat') || d.replace(/[\*\s\-_]/g, '') === 'ato');

      });

      if (matchAto) return matchAto;

    }



    // Demais categorias

    const testes = {

      sentenca: d => d.startsWith('acord') || d.startsWith('senten'),

      mandado: d => d.startsWith('mandad'),

      carta: d => d.startsWith('carta') && !d.includes('precat') && !d.includes('senten'),

      precatoria: d => d.startsWith('precat') || (d.startsWith('carta') && d.includes('precat')),

      certidao: d => d.startsWith('certid')

    };

    const teste = testes[ch];

    if (!teste) return null;



    const comAsteriscos = listaModelos.filter(m => (m.descricao || '').includes('*'));

    const achouComAst = comAsteriscos.find(m => teste(norm(m)));

    if (achouComAst) return achouComAst;

    return listaModelos.find(m => teste(norm(m))) || null;

  }



  async function selecionarModelo(item) {

    const txtModelo = document.getElementById('txtModelo');

    const hdnIdModelo = document.getElementById('hdnIdModelo');

    if (!txtModelo || !hdnIdModelo) return false;



    // Reseta campos do modelo antes de começar

    txtModelo.value = '';

    hdnIdModelo.value = '';



    const genericoObj = determinarModeloGenerico(item);

    const rawNome = padronizarPrefixoTipoModelo(item.modeloNome || '');

    let modelos = [];

    let selecionou = false;



    // 1. Se a preferência possui Modelo Específico na coluna da planilha, busca diretamente pelo nome completo (que já inicia pelo Tipo de Documento)

    if (rawNome && rawNome !== '-') {

      modelos = await mesclarModelosEspecificos(item, modelos);

      let mEspecifico = localizarMelhorModeloEspecifico(item, modelos);



      // Segurança extra no DOM: se ainda não localizou via fetch, consulta pelo autocomplete nativo de #txtModelo com o nome completo

      if (!mEspecifico) {

        const { itensAjax } = await executarBuscaModeloEObterItens(rawNome);

        if (Array.isArray(itensAjax) && itensAjax.length > 0) {

          registrarModelosNoPool(itensAjax);

          modelos = modelos.concat(itensAjax);

          mEspecifico = localizarMelhorModeloEspecifico(item, modelos);

        }

        const divMenu = document.getElementById('divInfraAjaxtxtModelo');

        if (divMenu) divMenu.style.display = 'none';

      }



      if (mEspecifico) {

        addLog(`🎯 Modelo específico localizado na Unidade: "${mEspecifico.descricao}"`);

        selecionou = await aplicarSelecaoModeloObjeto(mEspecifico);

      }

    }



    // 2. Fallback Obrigatório para a Matriz Genérica correspondente (quando não há modelo específico ou ele não existe na Vara)

    if (!selecionou) {

      const chave = genericoObj.chave;

      let mGenerico = identificarMatrizGenerica(modelos, chave);



      if (!mGenerico) {

        const termo = genericoObj.termoBusca || 'DESPACHO';

        const listaCat = await obterModelosPorTermo(termo);

        mGenerico = identificarMatrizGenerica(listaCat, chave);

      }



      if (!mGenerico) {

        const listaMatrizes = await obterModelosPorTermo('***');

        mGenerico = identificarMatrizGenerica(listaMatrizes, chave);

      }



      if (!mGenerico) {

        const termosExtraMap = {

          'despacho': ['DESP', 'DECIS'],

          'senten': ['ACORDAO', 'ACÓRDÃO', 'ACORD'],

          'ato': ['ATO'],

          'mandado': ['MANDAD', 'MANDADO'],

          'carta': ['CARTA'],

          'precatoria': ['*** CARTA PREC', '*** PRECAT', 'PRECAT', 'PRECATÓRIA', 'CARTA'],

          'certid': ['CERTID', 'CERTIDAO', 'CERTIDÃO']

        };

        const extras = termosExtraMap[chave] || [];

        for (const te of extras) {

          const lExtra = await obterModelosPorTermo(te);

          mGenerico = identificarMatrizGenerica(lExtra, chave);

          if (mGenerico) break;

        }

      }



      if (mGenerico) {

        addLog(`Aplicando Modelo Genérico (Fallback): "${mGenerico.descricao}"`);

        selecionou = await aplicarSelecaoModeloObjeto(mGenerico);

      }

    }



    if (!selecionou || !hdnIdModelo.value) {

      throw new Error(`Modelo não localizado para "${item.nome}" (esperado categoria ${genericoObj.nomeModelo}). Operação abortada para evitar preferência sem modelo.`);

    }



    return true;

  }



  

  // Inclusão v8.5: Automação Genérica e Dinâmica de Dados Complementares

  async function configurarDadosComplementares(pares, dados) {

    if (!pares || pares.length === 0) return;



    addLog(`Configurando Dados Complementares (${pares.length} campo(s))...`);



    // Localiza o botão "Alterar Autuação / Dados Complementares"

    // Localiza o botão "Alterar Autuação / Dados Complementares" com espera inteligente

    let btnAutuacao = null;

    for (let t = 0; t < 25; t++) {

      btnAutuacao = document.querySelector(

        '#divAgendarDadosProcesso button, button[title*="Alterar Autuação"], button[onclick*="agendar_alteracao"], #btnAlterarAutuacao'

      ) || Array.from(document.querySelectorAll('button, input[type="button"]')).find(b => {

        const txt = normalizar(b.textContent || b.value || '');

        return txt.includes('alterar autuacao') || txt.includes('dados complementares') || txt.includes('agendar alteracao');

      });

      if (btnAutuacao) break;

      await sleep(150);

    }



    if (!btnAutuacao) {

      addLog(`⚠️ Botão "Alterar Autuação / Dados Complementares" não está visível nesta tela após espera.`, 'warn');

      return;

    }



    destacarCampoAtivo(btnAutuacao, 'Dados Complementares', pares.map(p => `${p.campo}: ${p.valor}`).join('; '));



    const hdnAntes = (document.getElementById('hdnDadosComplementares') || {}).value || '';



    // Clica no botão para abrir o subframe

    btnAutuacao.click();

    await sleep(400);



    // Aguarda o iframe '#ifrSubFrm' carregar

    let iframeDoc = null;

    for (let t = 0; t < 50; t++) {

      const iframe = document.getElementById('ifrSubFrm');

      if (iframe && iframe.contentDocument && iframe.contentDocument.readyState === 'complete' && iframe.contentDocument.body && iframe.contentDocument.body.children.length > 0) {

        iframeDoc = iframe.contentDocument;

        break;

      }

      await sleep(150);

    }



    if (!iframeDoc) {

      addLog(`⚠️ Tela de "Agendamento de alteração dos dados do processo" demorou para responder.`);

      fecharSubframeSeAberto();

      return;

    }



    const alteracoesFeitas = [];



    // Antes de aplicar os pares desta linha, garante que todos os selects do subframe partam de "Não alterado"

    try {

      const selectsIniciais = Array.from(iframeDoc.querySelectorAll('select'));

      for (const sIni of selectsIniciais) {

        const optNA = Array.from(sIni.options).find(o => normalizar(o.text).includes('nao alterad')) ||

                      Array.from(sIni.options).find(o => o.value === '' || o.value === 'null');

        if (optNA && sIni.value !== optNA.value) {

          sIni.value = optNA.value;

          optNA.selected = true;

          dispararEventos(sIni, ['input', 'change']);

        }

      }

    } catch (e) {}



    for (const par of pares) {

      const campoDesejado = par.campo;

      const valorDesejado = par.valor;

      const campoNorm = normalizar(campoDesejado).replace(/[:]/g, '').trim();

      const valNorm = normalizar(valorDesejado).trim();



      let elEncontrado = null;



      // 1. Procura por <label> associado

      const labels = Array.from(iframeDoc.querySelectorAll('label'));

      for (const lbl of labels) {

        const lblNorm = normalizar(lbl.textContent).replace(/[:]/g, '').trim();

        if (lblNorm === campoNorm || lblNorm.includes(campoNorm) || campoNorm.includes(lblNorm)) {

          const forId = lbl.getAttribute('for');

          if (forId) elEncontrado = iframeDoc.getElementById(forId);

          if (!elEncontrado && lbl.parentElement) {

            elEncontrado = lbl.parentElement.querySelector('select, input, textarea');

          }

          if (!elEncontrado) {

            elEncontrado = lbl.querySelector('select, input, textarea');

          }

          if (elEncontrado) break;

        }

      }



      // 2. Se não achou por label, procura em <tr> (tabela de dados)

      if (!elEncontrado) {

        const trs = Array.from(iframeDoc.querySelectorAll('tr'));

        for (const tr of trs) {

          const cells = Array.from(tr.querySelectorAll('td, th'));

          const matchCell = cells.some(c => normalizar(c.textContent).includes(campoNorm));

          if (matchCell) {

            elEncontrado = tr.querySelector('select, input, textarea');

            if (elEncontrado) break;

          }

        }

      }



      // 3. Fallback: Procura por id ou name aproximado

      if (!elEncontrado) {

        const slug = campoNorm.replace(/[^a-z0-9]/g, '');

        if (slug.length >= 3) {

          const allInputs = iframeDoc.querySelectorAll('select, input, textarea');

          for (const inp of allInputs) {

            const idNorm = normalizar(inp.id || '');

            const nameNorm = normalizar(inp.name || '');

            if (idNorm.includes(slug) || nameNorm.includes(slug)) {

              elEncontrado = inp;

              break;

            }

          }

        }

      }



      if (!elEncontrado) {

        addLog(`⚠️ Campo "${campoDesejado}" não foi localizado na tela de agendamento.`);

        continue;

      }



      // Preenchimento conforme o tipo de elemento

      if (elEncontrado.tagName === 'SELECT') {

        let optMatch = null;

        const options = Array.from(elEncontrado.options);



        // A. Correspondência exata

        optMatch = options.find(o => normalizar(o.text).trim() === valNorm || normalizar(o.value).trim() === valNorm);



        // B. Regras semânticas (Deferido / Indeferido / Parcial)

        if (!optMatch) {

          if (valNorm.includes('parcial') || valNorm.includes('em parte')) {

            optMatch = options.find(o => normalizar(o.text).includes('parcial') || normalizar(o.text).includes('em parte'));

          } else if (valNorm.includes('indeferid') || valNorm.includes('nao concedid')) {

            optMatch = options.find(o => normalizar(o.text).includes('indeferid') || normalizar(o.text).includes('nao'));

          } else if (valNorm.includes('deferid') || valNorm.includes('concedid')) {

            optMatch = options.find(o => {

              const t = normalizar(o.text);

              return (t.includes('deferid') || t.includes('concedid')) && !t.includes('indeferid') && !t.includes('parcial') && !t.includes('em parte');

            });

          } else if (valNorm === 'sim' || valNorm === 's') {

            optMatch = options.find(o => normalizar(o.text) === 'sim' || o.value === 'S' || o.value === '1');

          } else if (valNorm === 'nao' || valNorm === 'n') {

            optMatch = options.find(o => normalizar(o.text) === 'nao' || o.value === 'N' || o.value === '0');

          }

        }



        // C. Substring genérica

        if (!optMatch) {

          optMatch = options.find(o => normalizar(o.text).includes(valNorm) || valNorm.includes(normalizar(o.text)));

        }



        if (optMatch) {

          elEncontrado.value = optMatch.value;

          dispararEventos(elEncontrado, ['input', 'change']);

          addLog(`✅ Campo "${campoDesejado}" definido como "${optMatch.text.trim()}"`);

          alteracoesFeitas.push(`${campoDesejado}: ${optMatch.text.trim()}`);

        } else {

          addLog(`⚠️ Opção "${valorDesejado}" não encontrada para o campo "${campoDesejado}".`);

        }

      } else if (elEncontrado.type === 'checkbox' || elEncontrado.type === 'radio') {

        const deveMarcar = ['sim', 's', '1', 'true', 'deferido', 'ativo', 'marcar', 'positivo'].includes(valNorm);

        const deveDesmarcar = ['nao', 'n', '0', 'false', 'indeferido', 'inativo', 'desmarcar', 'negativo'].includes(valNorm);

        if (deveMarcar) {

          elEncontrado.checked = true;

          dispararEventos(elEncontrado, ['click', 'input', 'change']);

          addLog(`✅ Campo "${campoDesejado}" marcado (Sim)`);

          alteracoesFeitas.push(`${campoDesejado}: Sim`);

        } else if (deveDesmarcar) {

          elEncontrado.checked = false;

          dispararEventos(elEncontrado, ['click', 'input', 'change']);

          addLog(`✅ Campo "${campoDesejado}" desmarcado (Não)`);

          alteracoesFeitas.push(`${campoDesejado}: Não`);

        }

      } else {

        elEncontrado.value = valorDesejado;

        dispararEventos(elEncontrado, ['input', 'change']);

        addLog(`✅ Campo "${campoDesejado}" preenchido com "${valorDesejado}"`);

        alteracoesFeitas.push(`${campoDesejado}: ${valorDesejado}`);

      }

      await sleep(150);

    }



    if (alteracoesFeitas.length > 0) {

      await sleep(250);



      // Localiza o botão de Salvar no subframe de forma abrangente:

      const botoes = Array.from(iframeDoc.querySelectorAll('button, input[type="button"], input[type="submit"], a.infraButton, input.infraButton'));

      let btnSalvarSub = botoes.find(b => {

        const id = (b.id || '').toLowerCase();

        const name = (b.name || '').toLowerCase();

        const val = (b.value || '').toLowerCase();

        const txt = (b.textContent || b.innerText || '').toLowerCase().trim();



        if (id.includes('cancelar') || name.includes('cancelar') || txt.includes('cancelar') ||

            id.includes('fechar') || name.includes('fechar') || txt.includes('fechar') ||

            id.includes('voltar') || name.includes('voltar') || txt.includes('voltar')) {

          return false;

        }



        return (

          id.includes('salvar') || id.includes('gravar') || id.includes('sbm') || id === 'btnok' ||

          name.includes('salvar') || name.includes('gravar') || name.includes('sbm') ||

          val.includes('salvar') || val.includes('gravar') || val.includes('confirmar') || val.includes('ok') ||

          txt.includes('salvar') || txt.includes('gravar') || txt.includes('confirmar') || txt === 'ok'

        );

      });



      const exato = botoes.find(b => ((b.textContent || b.value || '').trim().toLowerCase() === 'salvar'));

      if (exato) btnSalvarSub = exato;

      addLog(`Salvando alterações no subframe de dados complementares...`);



      if (btnSalvarSub) {

        try { btnSalvarSub.focus(); } catch (e) {}

        btnSalvarSub.click();

        if (btnSalvarSub.form && typeof btnSalvarSub.form.requestSubmit === 'function') {

          try {

            btnSalvarSub.form.requestSubmit(btnSalvarSub);

          } catch (e) {}

        }

      } else {

        const anySubmit = iframeDoc.querySelector('input[type="submit"], button[type="submit"]');

        if (anySubmit) {

          anySubmit.click();

        } else {

          const frm = iframeDoc.querySelector('form');

          if (frm) {

            if (typeof frm.requestSubmit === 'function') {

              try { frm.requestSubmit(); } catch (e) { frm.submit(); }

            } else {

              frm.submit();

            }

          }

        }

      }



      // Aguarda a persistência real no formulário principal:

      // O eproc atualiza parent.document.getElementById('hdnDadosComplementares').value

      // e/ou parent.document.getElementById('descDadosComplementares').innerHTML

      const hdnComp = document.getElementById('hdnDadosComplementares');

      const descComp = document.getElementById('descDadosComplementares');

      let salvouOk = false;



      for (let t = 0; t < 60; t++) {

        await sleep(150);

        const ifr = document.getElementById('ifrSubFrm');

        const hdnAtual = (hdnComp ? hdnComp.value : '').trim();

        const descAtual = (descComp ? descComp.textContent : '').trim();



        if ((hdnAtual && hdnAtual !== hdnAntes) || descAtual.length > 0) {

          salvouOk = true;

          break;

        }



        if (!ifr || ifr.style.display === 'none' || ifr.style.visibility === 'hidden') {

          await sleep(250);

          if ((hdnComp && hdnComp.value.trim().length > 0) || (descComp && descComp.textContent.trim().length > 0)) {

            salvouOk = true;

          }

          break;

        }

      }



      const hdnFinal = (hdnComp ? hdnComp.value : '').trim();

      const descFinal = (descComp ? descComp.textContent : '').trim();



      if (salvouOk || hdnFinal || descFinal) {

        if (dados) {

          dados.dadosComplementares = descFinal || alteracoesFeitas.join('; ');

        }

        addLog(`✅ Dados complementares gravados no processo: ${descFinal || alteracoesFeitas.join('; ')}`);

      } else {

        try {

          const nested = Array.from(iframeDoc.querySelectorAll('iframe')).map(f => { try { return (f.contentDocument.body.innerText || '').trim().slice(0, 160).replace(/\s+/g, ' '); } catch (e) { return '(sem acesso)'; } });

          addLog('⚠️ Dados complementares NÃO foram transferidos ao formulário. Botões do subframe: ' + botoes.map(b => (b.textContent || b.value || b.id || '').trim()).filter(Boolean).join(' | ') + ' | Frames internos: ' + (nested.join(' || ') || '(nenhum)'), 'warn');

        } catch (e) {}

      }



      await sleep(300);

      fecharSubframeSeAberto();

    } else {

      addLog(`⚠️ Nenhuma alteração foi realizada nos dados complementares.`);

      fecharSubframeSeAberto();

    }

  }



  /* ================== LIMPEZA PROFUNDA DE DADOS COMPLEMENTARES ================== */

  function limparDadosComplementares() {

    try {

      // 1. Limpa variáveis em memória global do eproc

      if (typeof window !== 'undefined') {

        window.mc_strDadosComplementares = '';

        window.mc_strDadosAutuacao = '';

        window._eprocDadosComplementaresAtuais = null;

        try {

          if (typeof mc_strDadosComplementares !== 'undefined') mc_strDadosComplementares = '';

        } catch (e) {}

        try {

          if (typeof mc_strDadosAutuacao !== 'undefined') mc_strDadosAutuacao = '';

        } catch (e) {}

      }



      // 2. Garante a existência e limpa elementos do DOM principal (NUNCA remover #hdnDadosComplementares)

      const divComp = document.getElementById('divDadosComplementares');

      let hdnComp = document.getElementById('hdnDadosComplementares');

      if (!hdnComp && divComp) {

        hdnComp = document.createElement('input');

        hdnComp.type = 'hidden';

        hdnComp.id = 'hdnDadosComplementares';

        hdnComp.name = 'hdnDadosComplementares';

        hdnComp.value = '';

        divComp.appendChild(hdnComp);

      }

      if (hdnComp) {

        hdnComp.value = '';

        hdnComp.setAttribute('value', '');

      }

      const descComp = document.getElementById('descDadosComplementares');

      if (descComp) {

        descComp.innerHTML = '';

        descComp.textContent = '';

      }



      const divAut = document.getElementById('divDadosAutuacao');

      let hdnAut = document.getElementById('hdnDadosAutuacao');

      if (!hdnAut && divAut) {

        hdnAut = document.createElement('input');

        hdnAut.type = 'hidden';

        hdnAut.id = 'hdnDadosAutuacao';

        hdnAut.name = 'hdnDadosAutuacao';

        hdnAut.value = '';

        divAut.appendChild(hdnAut);

      }

      if (hdnAut) {

        hdnAut.value = '';

        hdnAut.setAttribute('value', '');

      }

      const descAut = document.getElementById('descDadosAutuacao');

      if (descAut) {

        descAut.innerHTML = '';

        descAut.textContent = '';

      }



      // 3. Limpeza com jQuery (se disponível) preservando os inputs ocultos nativos

      if (typeof window.jQuery === 'function' || typeof window.$ === 'function') {

        const jq = window.jQuery || window.$;

        try {

          jq('#hdnDadosComplementares, input[name="hdnDadosComplementares"]').val('').attr('value', '');

          jq('#descDadosComplementares').empty().text('');

          jq('#hdnDadosAutuacao, input[name="hdnDadosAutuacao"]').val('').attr('value', '');

          jq('#descDadosAutuacao').empty().text('');

          jq('#frmMinutaCadastro input[name="selDadoComplementarProcessoSelecionados"]').remove();

        } catch (e) {}

      }



      // 4. Remove apenas inputs auxiliares de seleção de processos de dados complementares

      const inputsDinamicos = document.querySelectorAll('input[name="selDadoComplementarProcessoSelecionados"]');

      inputsDinamicos.forEach(el => { try { el.remove(); } catch (e) {} });



      // 5. Garante que subframes abertos sejam fechados

      fecharSubframeSeAberto();

    } catch (err) {

      console.warn('Erro ao limpar dados complementares:', err);

    }

  }



  async function resetarDadosComplementaresNoSubframe() {

    try {

      let btnAutuacao = null;

      for (let t = 0; t < 15; t++) {

        btnAutuacao = document.querySelector(

          '#divAgendarDadosProcesso button, button[title*="Alterar Autuação"], button[onclick*="agendar_alteracao"], #btnAlterarAutuacao'

        ) || Array.from(document.querySelectorAll('button, input[type="button"]')).find(b => {

          const txt = normalizar(b.textContent || b.value || '');

          return txt.includes('alterar autuacao') || txt.includes('dados complementares') || txt.includes('agendar alteracao');

        });

        if (btnAutuacao) break;

        await sleep(120);

      }



      if (!btnAutuacao) {

        limparDadosComplementares();

        return;

      }



      destacarCampoAtivo(btnAutuacao, 'Dados Complementares', 'Redefinindo para "Não alterado"...');

      btnAutuacao.click();

      await sleep(350);



      let iframeDoc = null;

      for (let t = 0; t < 40; t++) {

        const iframe = document.getElementById('ifrSubFrm');

        if (iframe && iframe.contentDocument && iframe.contentDocument.readyState === 'complete' && iframe.contentDocument.body && iframe.contentDocument.body.children.length > 0) {

          iframeDoc = iframe.contentDocument;

          break;

        }

        await sleep(150);

      }



      if (!iframeDoc) {

        fecharSubframeSeAberto();

        limparDadosComplementares();

        return;

      }



      // Percorre o documento do subframe (e eventuais iframes internos) para definir todos os selects como "Não alterado"

      const docs = [iframeDoc];

      Array.from(iframeDoc.querySelectorAll('iframe')).forEach(f => {

        try { if (f.contentDocument) docs.push(f.contentDocument); } catch (e) {}

      });



      let redefinidos = 0;

      for (const d of docs) {

        const selects = Array.from(d.querySelectorAll('select'));

        for (const sel of selects) {

          const opts = Array.from(sel.options);

          const optNaoAlt = opts.find(o => normalizar(o.text).includes('nao alterad')) ||

                            opts.find(o => o.value === '' || o.value === 'null');

          if (optNaoAlt) {

            sel.value = optNaoAlt.value;

            optNaoAlt.selected = true;

            dispararEventos(sel, ['input', 'change']);

            redefinidos++;

          }

        }

      }



      if (redefinidos > 0) {

        await sleep(200);

        let botoes = [];

        docs.forEach(d => {

          botoes.push(...Array.from(d.querySelectorAll('button, input[type="button"], input[type="submit"], a.infraButton, input.infraButton')));

        });

        let btnSalvarSub = botoes.find(b => ((b.textContent || b.value || '').trim().toLowerCase() === 'salvar')) ||

          botoes.find(b => {

            const id = (b.id || '').toLowerCase();

            const name = (b.name || '').toLowerCase();

            const val = (b.value || '').toLowerCase();

            const txt = (b.textContent || b.innerText || '').toLowerCase().trim();

            if (id.includes('cancelar') || txt.includes('cancelar') || id.includes('fechar') || txt.includes('fechar') || id.includes('voltar') || txt.includes('voltar')) return false;

            return id.includes('salvar') || id.includes('gravar') || id.includes('sbm') || name.includes('salvar') || val.includes('salvar') || txt.includes('salvar') || txt === 'ok';

          });



        if (btnSalvarSub) {

          try { btnSalvarSub.focus(); } catch (e) {}

          btnSalvarSub.click();

          if (btnSalvarSub.form && typeof btnSalvarSub.form.requestSubmit === 'function') {

            try { btnSalvarSub.form.requestSubmit(btnSalvarSub); } catch (e) {}

          }

        } else {

          const frm = iframeDoc.querySelector('form');

          if (frm) {

            try { frm.submit(); } catch (e) {}

          }

        }



        for (let t = 0; t < 25; t++) {

          await sleep(150);

          const ifr = document.getElementById('ifrSubFrm');

          const hdnComp = document.getElementById('hdnDadosComplementares');

          const descComp = document.getElementById('descDadosComplementares');

          const hdnVazio = !hdnComp || !hdnComp.value.trim();

          const descVazio = !descComp || !descComp.textContent.trim();

          if (!ifr || ifr.style.display === 'none' || ifr.style.visibility === 'hidden' || (t >= 5 && hdnVazio && descVazio)) {

            break;

          }

        }

        addLog('🧹 Dados complementares redefinidos para "Não alterado" no subframe.');

      }



      await sleep(200);

      fecharSubframeSeAberto();

      limparDadosComplementares();

    } catch (err) {

      console.warn('Erro ao resetar dados complementares no subframe:', err);

      fecharSubframeSeAberto();

      limparDadosComplementares();

    }

  }



  function limparEventosComplementares() {

    window._eprocEventosCompAtuais = [];

    const selComp = document.getElementById('selEventoComplementar');

    if (selComp) {

      selComp.setAttribute('multiple', 'multiple');

      selComp.multiple = true;

      for (const opt of selComp.options) {

        opt.selected = false;

        opt.removeAttribute('selected');

      }

      if (typeof window.$ === 'function' && typeof window.$('#selEventoComplementar').multipleSelect === 'function') {

        try {

          window.$('#selEventoComplementar').multipleSelect('uncheckAll');

          window.$('#selEventoComplementar').multipleSelect('setSelects', []);

        } catch (e) {}

      }

      const dropComp = document.getElementById('ms-drop-selEventoComplementar') || document.querySelector('.ms-drop');

      if (dropComp) {

        dropComp.querySelectorAll('input[type=checkbox]').forEach(cb => {

          cb.checked = false;

          cb.removeAttribute('checked');

        });

      }

      dispararEventos(selComp, ['change']);

    }

  }



  async function selecionarEventosComplementares(eventosCompBruto, dados) {

    const eventosComp = (eventosCompBruto || []).map(e => {

      if (e && typeof e === 'object') return e;

      const s = String(e || '').trim();

      const m = s.match(/\((\d+)\)/);

      return { cod: m ? m[1] : '', nome: s.replace(/\(\d+\)/g, '').trim() };

    });

    const selComp = document.getElementById('selEventoComplementar');

    if (!selComp) return;



    // 1. Limpa completamente qualquer seleção anterior

    limparEventosComplementares();

    await sleep(100);



    addLog(`Verificando eventos complementares (${eventosComp.length} solicitado(s))...`);

    destacarCampoAtivo(selComp, 'Eventos Complementares', eventosComp.map(e => e.cod || e.nome).join(', '));



    // Se o combo estiver vazio e tivermos evento principal, dispara busca

    const hdnEv = document.getElementById('hdnEvento');

    if ((!selComp.options || selComp.options.length <= 1) && hdnEv && hdnEv.value && typeof window.buscaEventosComplementares === 'function') {

      try { window.buscaEventosComplementares(hdnEv.value); } catch (e) {}

    }



    // Aguarda até 4s o AJAX do eproc (buscaEventosComplementares) preencher o combo

    let opcoesValidas = [];

    for (let t = 0; t < 40; t++) {

      opcoesValidas = Array.from(selComp.options).filter(o => o.value && o.value !== 'null');

      if (opcoesValidas.length > 0) break;

      await sleep(100);

    }



    if (opcoesValidas.length === 0) {

      addLog(`⚠️ O eproc não carregou eventos complementares disponíveis para este evento principal.`);

      return;

    }



    // Garante que o select possui o atributo multiple nativo no DOM para que o jQuery serialize corretamente

    selComp.setAttribute('multiple', 'multiple');

    selComp.multiple = true;



    // Desmarca tudo primeiro no DOM e plugin

    for (const opt of selComp.options) {

      opt.selected = false;

      opt.removeAttribute('selected');

    }

    if (typeof window.$ === 'function' && typeof window.$('#selEventoComplementar').multipleSelect === 'function') {

      try {

        window.$('#selEventoComplementar').multipleSelect('uncheckAll');

        window.$('#selEventoComplementar').multipleSelect('setSelects', []);

      } catch (e) {}

    }



    const valuesSelecionados = [];

    const nomesSelecionados = [];



    for (const comp of eventosComp) {

      const codDesejado = String(comp.cod || '').trim();

      const nomeDesejado = normalizar(String(comp.nome || '').replace(/\(\d+\)/g, '').trim());



      let optEncontrada = null;



      // 1. Busca por código numérico no texto da opção: ex: "(785)" ou "(332)" ou "(889)" ou no valor

      if (codDesejado && /^\d+$/.test(codDesejado)) {

        optEncontrada = opcoesValidas.find(o => {

          const txt = o.text || '';

          return txt.includes(`(${codDesejado})`) || o.value === codDesejado;

        });

      }



      // 2. Busca por texto da descrição

      if (!optEncontrada && nomeDesejado) {

        optEncontrada = opcoesValidas.find(o => {

          const txtNorm = normalizar(o.text || '');

          return txtNorm.includes(nomeDesejado) || nomeDesejado.includes(txtNorm);

        });

      }



      if (optEncontrada) {

        valuesSelecionados.push(optEncontrada.value);

        nomesSelecionados.push(optEncontrada.text.trim());

        addLog(`✅ Evento complementar selecionado: "${optEncontrada.text.trim()}" (Cód: ${optEncontrada.value})`);

      } else {

        addLog(`⚠️ Evento complementar "${comp.nome || comp.cod}" não encontrado no combo.`);

      }

    }



    if (valuesSelecionados.length > 0) {

      // 1. Marca no DOM nativo (selected = true E setAttribute('selected', 'selected'))

      for (const opt of selComp.options) {

        const isMatch = valuesSelecionados.includes(opt.value);

        opt.selected = isMatch;

        if (isMatch) {

          opt.setAttribute('selected', 'selected');

        } else {

          opt.removeAttribute('selected');

        }

      }



      // 2. Atualiza via multipleSelect plugin (sem chamar refresh para não resetar seleções!)

      if (typeof window.$ === 'function' && typeof window.$('#selEventoComplementar').multipleSelect === 'function') {

        try {

          window.$('#selEventoComplementar').multipleSelect('setSelects', valuesSelecionados);

        } catch (e) {

          console.warn('Erro ao atualizar multipleSelect setSelects:', e);

        }

      }



      // 3. Marca fisicamente os checkboxes no dropdown do multipleSelect

      const dropComp = document.getElementById('ms-drop-selEventoComplementar') || document.querySelector('.ms-drop');

      if (dropComp) {

        dropComp.querySelectorAll('input[type=checkbox]').forEach(cb => {

          const isSel = valuesSelecionados.includes(cb.value);

          cb.checked = isSel;

          if (isSel) cb.setAttribute('checked', 'checked');

          else cb.removeAttribute('checked');

        });

      }



      // 4. Registra no escopo global para o hook de gravação garantir a persistência no payload

      window._eprocEventosCompAtuais = valuesSelecionados;



      dispararEventos(selComp, ['change']);

      if (dados) {

        dados.eventosComp = nomesSelecionados;

      }

    } else {

      limparEventosComplementares();

    }

  }



  function fecharSubframeSeAberto() {

    try {

      if (typeof window.infraOcultarAviso === 'function') window.infraOcultarAviso();

      if (typeof window.infraFecharSubFrm === 'function') window.infraFecharSubFrm();

      const ifr = document.getElementById('ifrSubFrm');

      if (ifr) ifr.remove();

      const fundo = document.getElementById('divInfraAvisoFundo');

      if (fundo) fundo.remove();

    } catch (e) {}

  }



  async function selecionarEvento(textoEventoBruto, codExplicit = '') {

    const txtEvento = document.getElementById('txtEvento');

    const hdnEvento = document.getElementById('hdnEvento');

    if (!txtEvento || !hdnEvento) return false;



    // Extrai o código numérico entre parênteses ou usa o código explícito da coluna

    const mCod = String(textoEventoBruto).match(/\((\d+)\)/);

    const codEvento = (codExplicit && codExplicit !== '-') ? String(codExplicit).trim() : (mCod ? mCod[1] : '');

    const descLimpa = normalizar(String(textoEventoBruto).replace(/\(\d+\)/g, '').replace(/^decis[a-z/ ]+-/i, '').trim());



    addLog(`Preenchendo Evento: "${textoEventoBruto}" (código: ${codEvento || 'texto'})...`);



    // Define termo de digitação inteligente:

    // Se o código for '60' (genérico de expedição) ou curto, NUNCA digita '60' puro!

    // Digita o texto do ato para evitar que o eproc traga eventos aleatórios contendo '60' (ex: Autos restaurados 12260).

    const termosParaTentar = [];

    if (codEvento && codEvento !== '60' && /^\d{3,}$/.test(codEvento)) {

      termosParaTentar.push(codEvento);

      termosParaTentar.push(descLimpa.slice(0, 25));

    } else {

      if (descLimpa.includes('mandad')) {

        termosParaTentar.push('Expedição de mandado', 'Mandado');

      } else if (descLimpa.includes('correio') || (descLimpa.includes('carta') && !descLimpa.includes('precator') && !descLimpa.includes('ordem'))) {

        termosParaTentar.push('Expedição de Carta pelo Correio', 'Carta pelo Correio', 'Carta');

      } else if (descLimpa.includes('precator') || descLimpa.includes('ordem')) {

        termosParaTentar.push('Expedição de Carta de Ordem', 'Carta de Ordem', 'Precatória');

      } else {

        termosParaTentar.push(descLimpa.slice(0, 25));

      }

    }



    // Função de validação se um item de evento casa estritamente com o desejado

    function casaComEvento(itemEv) {

      if (!itemEv) return false;

      const rawDesc = itemEv.descricao || '';

      const dNorm = normalizar(rawDesc);

      const evId = String(itemEv.id || '').trim();



      // Regra anti-falso-positivo: se estamos procurando mandado/carta/precatória, NUNCA aceita "autos restaurados"!

      if (dNorm.includes('autos restaurados')) {

        return false;

      }



      // Se temos código específico (>= 3 dígitos, diferente de 60):

      if (codEvento && codEvento !== '60' && /^\d{3,}$/.test(codEvento)) {

        if (evId === codEvento || rawDesc.includes(`(${codEvento})`)) {

          return true;

        }

      }



      // Regras estritas por família de evento:

      if (descLimpa.includes('mandad')) {

        const ehMandado = dNorm.includes('mandad');

        const has60 = rawDesc.includes('(60)') || evId === '60';

        return ehMandado && (has60 || !codEvento || codEvento === '60');

      }



      if (descLimpa.includes('correio') || (descLimpa.includes('carta') && !descLimpa.includes('precator') && !descLimpa.includes('ordem'))) {

        const ehCartaCorreio = (dNorm.includes('correio') || dNorm.includes('carta')) && !dNorm.includes('precator') && !dNorm.includes('ordem');

        const has60 = rawDesc.includes('(60)') || evId === '60';

        return ehCartaCorreio && (has60 || !codEvento || codEvento === '60');

      }



      if (descLimpa.includes('precator') || descLimpa.includes('ordem')) {

        const ehPrecatoria = dNorm.includes('precator') || dNorm.includes('ordem');

        const has60 = rawDesc.includes('(60)') || evId === '60';

        return ehPrecatoria && (has60 || !codEvento || codEvento === '60');

      }



      // Para outros atos (Despacho, Decisão, Ato, Sentença):

      if (dNorm === descLimpa || dNorm.includes(descLimpa) || descLimpa.includes(dNorm)) {

        if (codEvento) {

          return evId === codEvento || rawDesc.includes(`(${codEvento})`);

        }

        return true;

      }



      return false;

    }



    let itemEncontrado = null;

    let idxEscolhido = -1;



    for (const termo of termosParaTentar) {

      txtEvento.focus();

      txtEvento.value = termo;

      dispararEventos(txtEvento, ['input', 'keydown', 'keyup', 'change']);



      if (window.objAjaxAutoCompEvento && typeof window.objAjaxAutoCompEvento.executar === 'function') {

        try { window.objAjaxAutoCompEvento.executar(); } catch (e) {}

      }



      const lis = await esperarMenuAutocomplete('divInfraAjaxtxtEvento', 2500);

      const itens = (window.objAjaxAutoCompEvento && Array.isArray(window.objAjaxAutoCompEvento.arrItens)) ? window.objAjaxAutoCompEvento.arrItens : [];



      for (let i = 0; i < itens.length; i++) {

        if (casaComEvento(itens[i])) {

          idxEscolhido = i;

          itemEncontrado = itens[i];

          break;

        }

      }



      if (itemEncontrado) {

        if (window.objAjaxAutoCompEvento && typeof window.objAjaxAutoCompEvento.escolher === 'function') {

          try { window.objAjaxAutoCompEvento.escolher(idxEscolhido); } catch (e) {}

        }

        if (lis && lis[idxEscolhido]) {

          dispararClique(lis[idxEscolhido]);

        }

        break;

      }

    }



    // Se o autocomplete visual não retornou, tenta pelo fetch direto via obterEventosPorTermo:

    if (!itemEncontrado) {

      for (const termo of termosParaTentar) {

        const listaAjax = await obterEventosPorTermo(termo);

        const achou = listaAjax.find(casaComEvento);

        if (achou) {

          itemEncontrado = achou;

          break;

        }

      }

    }



    if (!itemEncontrado) {

      const relax = [];

      for (const termo of [descLimpa.slice(0, 30), descLimpa.slice(0, 18)]) {

        const lista = (await obterEventosPorTermo(termo)) || [];

        lista.forEach(x => relax.push(x));

        const achou = lista.find(x => {

          const d = normalizar(x.descricao || '');

          if (d.includes('autos restaurados')) return false;

          const curto = d.replace(/^decisao\/despacho\s*-\s*/, '').replace(/\(\d+\)/g, '').trim();

          return d.includes(descLimpa) || (curto.length > 8 && descLimpa.includes(curto));

        });

        if (achou) { itemEncontrado = achou; addLog('ℹ️ Evento localizado pela descrição (código diferente do da planilha): "' + achou.descricao + '"'); break; }

      }

      if (!itemEncontrado) addLog('⚠️ Candidatos no catálogo: ' + (relax.slice(0, 8).map(x => x.descricao).join(' | ') || '(nenhum)'), 'warn');

    }



    if (itemEncontrado) {

      hdnEvento.value = itemEncontrado.id;

      txtEvento.value = itemEncontrado.descricao;



      if (window.objAjaxAutoCompEvento && typeof window.objAjaxAutoCompEvento.processarResultado === 'function') {

        try { window.objAjaxAutoCompEvento.processarResultado(itemEncontrado.id, itemEncontrado.descricao, 'null'); } catch (e) {}

      }



      if (typeof window.prepararMovimentacao === 'function') {

        try { window.prepararMovimentacao(itemEncontrado.id); } catch (e) {}

      }



      if (typeof window.buscaEventosComplementares === 'function') {

        try { window.buscaEventosComplementares(itemEncontrado.id); } catch (e) {}

      }



      // Aguarda carregamento AJAX do divExibeHTML pelo eproc

      const divExibe = document.getElementById('divExibeHTML');

      let aguardouDivExibe = 0;

      while (aguardouDivExibe < 3500) {

        if (divExibe && divExibe.style.display !== 'none' && divExibe.children.length > 0 && divExibe.innerHTML.trim() !== 'Html') {

          break;

        }

        await sleep(150);

        aguardouDivExibe += 150;

      }

      await sleep(300);

      addLog(`✅ Evento selecionado: "${itemEncontrado.descricao}" (Cód: ${itemEncontrado.id})`);

      return true;

    }



    addLog(`⚠️ Aviso: Evento "${textoEventoBruto}" não localizado com precisão no catálogo do eproc. O campo não foi preenchido com evento incorreto.`, 'warn');

    return false;

  }



  /* ================== GERENCIAMENTO E CADASTRO AUTOMÁTICO DE CLASSIFICAÇÃO ================== */

  const cacheClassificacoesUnidade = new Map();

  let totalClassificacoesCriadasNoLote = 0;



  function obterUrlListarClassificacoes() {

    if (window.mc_strLink) return window.mc_strLink;

    for (const s of document.scripts) {

      if (s.textContent && s.textContent.includes('classificacao_conteudo_listar')) {

        const m = s.textContent.match(/mc_strLink\s*=\s*['"]([^'"]+)['"]/);

        if (m) return m[1];

        const m2 = s.textContent.match(/['"](controlador\.php\?[^'"]*acao=classificacao_conteudo_listar[^'"]*)['"]/);

        if (m2) return m2[1];

      }

    }

    const hash = typeof obterHashAtual === 'function' ? obterHashAtual() : '';

    if (hash) {

      return `controlador.php?acao=classificacao_conteudo_listar&origem=minuta&acao_origem=minuta_cadastrar&hash=${hash}`;

    }

    return null;

  }



  function obterUrlAjaxClassificacoes() {

    if (window.mc_strLinkClassificacaoConteudo) return window.mc_strLinkClassificacaoConteudo;

    for (const s of document.scripts) {

      if (s.textContent && s.textContent.includes('montar_classificacao_conteudo_minuta')) {

        const m = s.textContent.match(/mc_strLinkClassificacaoConteudo\s*=\s*['"]([^'"]+)['"]/);

        if (m) return m[1];

        const m2 = s.textContent.match(/['"](controlador_ajax\.php\?[^'"]*acao_ajax=montar_classificacao_conteudo_minuta[^'"]*)['"]/);

        if (m2) return m2[1];

      }

    }

    const hash = typeof obterHashAtual === 'function' ? obterHashAtual() : '';

    if (hash) {

      return `controlador_ajax.php?acao_ajax=montar_classificacao_conteudo_minuta&idMinuta=&hash=${hash}`;

    }

    return null;

  }



  // 1. Varre a tabela oficial de classificações da Unidade (via URL ou janela do eproc)

  async function carregarTodasClassificacoesDaTabela() {

    const mapa = new Map();

    const urlListar = obterUrlListarClassificacoes();

    if (!urlListar) return mapa;



    try {

      const resp = await fetch(urlListar, { credentials: 'same-origin' });

      if (resp.ok) {

        const html = await lerRespostaTexto(resp);

        const doc = new DOMParser().parseFromString(html, 'text/html');



        const linhas = doc.querySelectorAll('tr');

        linhas.forEach(tr => {

          if (tr.querySelector('th')) return;



          // Procura checkbox da linha (ex: chkInfraItem0, chkInfraItem1, infraCheckbox...)

          const chk = tr.querySelector('input[type="checkbox"]:not(#chkInfraSelecionarTodos):not([id*="SelecionarTodos"]):not([name*="SelecionarTodos"])');

          let id = chk ? (chk.value || '').trim() : '';



          // Se o checkbox não tiver o ID numérico, busca em links na linha

          if (!id || !/^\d+$/.test(id)) {

            const m = tr.innerHTML.match(/id_classificacao(?:_conteudo)?=(\d+)/i) ||

                      tr.innerHTML.match(/id=(\d+)/i) ||

                      tr.innerHTML.match(/valor=(\d+)/i);

            if (m) id = m[1];

          }



          if (!id || !/^\d+$/.test(id)) return;



          // Descrição na coluna 2 da tabela

          const tds = Array.from(tr.querySelectorAll('td'));

          let rawNome = '';

          if (tds.length >= 2) {

            rawNome = tds[1].textContent.trim();

          }

          if (!rawNome) {

            for (let i = 1; i < tds.length; i++) {

              const txt = tds[i].textContent.trim();

              if (txt && !tds[i].querySelector('input[type="checkbox"]') && !tds[i].querySelector('a, button, img')) {

                rawNome = txt;

                break;

              }

            }

          }



          if (id && rawNome) {
            rawNome = decodeEntities(rawNome);
            const itemObj = { id, text: rawNome };
            const chvExact = rawNome.trim();
            const chvUpper = rawNome.toUpperCase().trim();
            const chvNorm = normalizar(rawNome);

            mapa.set(chvExact, itemObj);
            mapa.set(chvUpper, itemObj);
            if (!mapa.has(chvNorm)) mapa.set(chvNorm, itemObj);

            cacheClassificacoesUnidade.set(chvExact, itemObj);
            cacheClassificacoesUnidade.set(chvUpper, itemObj);
            if (!cacheClassificacoesUnidade.has(chvNorm)) {
              cacheClassificacoesUnidade.set(chvNorm, itemObj);
            }
          }
        });
      }
    } catch (e) {
      console.warn('Erro ao carregar tabela de classificações:', e);
    }

    return mapa;
  }

  // 2. Consulta Select2 com termo específico (ex: "INTIMAÇÃO", "CITAÇÃO", "MANIFESTAÇÃO")
  async function buscarClassificacaoPorAjax(termo) {
    const urlAjax = obterUrlAjaxClassificacoes();
    if (!urlAjax || !termo) return [];

    const termosTentar = [termo];
    const semEmoji = termo.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu, '').trim();
    if (semEmoji && semEmoji !== termo && !termosTentar.includes(semEmoji)) {
      termosTentar.push(semEmoji);
    }
    const semAcento = normalizar(termo);
    if (semAcento && !termosTentar.includes(semAcento)) {
      termosTentar.push(semAcento);
    }

    for (const t of termosTentar) {
      try {
        const resp = await fetch(urlAjax, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'txtClassificacao=' + encodeURIComponent(toHtmlEntityDecimal(t)),
          credentials: 'same-origin'
        });
        if (resp.ok) {
          const dados = await resp.json();
          if (Array.isArray(dados) && dados.length > 0) {
            dados.forEach(item => {
              if (item && item.id && item.text) {
                const id = String(item.id).trim();
                const text = decodeEntities(String(item.text).trim());
                if (/^\d+$/.test(id) && text) {
                  const obj = { id, text };
                  const chvExact = text.trim();
                  const chvUpper = text.toUpperCase().trim();
                  const chvNorm = normalizar(text);

                  cacheClassificacoesUnidade.set(chvExact, obj);
                  cacheClassificacoesUnidade.set(chvUpper, obj);
                  if (!cacheClassificacoesUnidade.has(chvNorm)) {
                    cacheClassificacoesUnidade.set(chvNorm, obj);
                  }
                }
              }
            });
            return dados;
          }
        }
      } catch (e) {}
    }

    return [];
  }

  // Injeção visual direta no Select2 e preenchimento dos campos nativos (suporta 1 ou múltiplas classificações)
  function aplicarClassificacaoNaTela(classificacoes) {
    const elClassif = document.getElementById('selClassificacaoConteudo') || document.getElementById('selClassificacaoConteudoIds');
    const elIds = document.getElementById('selClassificacaoConteudoIds');
    const $ = window.$ || window.jQuery;

    let lista = [];
    if (Array.isArray(classificacoes)) {
      lista = classificacoes.filter(c => c && /^\d+$/.test(String(c.id || '').trim()));
    } else if (classificacoes && /^\d+$/.test(String(classificacoes.id || '').trim())) {
      lista = [classificacoes];
    }

    if (lista.length > 0) {
      const idsArr = lista.map(c => String(c.id).trim());
      const idStr = idsArr.join(',');
      const dataS2 = lista.map(c => ({ id: String(c.id).trim(), text: String(c.text || '').trim() }));

      // 1. Aciona Select2 via jQuery se disponível
      if ($ && elClassif && $(elClassif).data('select2')) {
        try { $(elClassif).select2('data', dataS2); } catch (e) {}
      }

      // 2. Define SEMPRE os IDs numéricos nos inputs nativos (separados por vírgula para validarPreferencias())
      if (elClassif) {
        elClassif.value = idStr;
        elClassif.setAttribute('value', idStr);
      }
      if (elIds) {
        elIds.value = idStr;
        elIds.setAttribute('value', idStr);
      }

      // 3. INJEÇÃO VISUAL DIRETA NO CONTAINER SELECT2 (Garante 100% que todas as tags/pills apareçam na tela)
      const s2Container = document.getElementById('s2id_selClassificacaoConteudo') || (elClassif && elClassif.closest('div')?.querySelector('.select2-container'));
      if (s2Container) {
        const choicesUl = s2Container.querySelector('ul.select2-choices');
        if (choicesUl) {
          choicesUl.querySelectorAll('li.select2-search-choice').forEach(li => li.remove());
          const searchField = choicesUl.querySelector('li.select2-search-field');

          dataS2.forEach(item => {
            const choiceLi = document.createElement('li');
            choiceLi.className = 'select2-search-choice';
            choiceLi.innerHTML = `<div>${item.text}</div><a href="#" class="select2-search-choice-close" tabindex="-1"></a>`;
            if (searchField) {
              choicesUl.insertBefore(choiceLi, searchField);
            } else {
              choicesUl.appendChild(choiceLi);
            }
          });
        }
      }

      window._eprocClassificacaoAtual = dataS2;
      return true;
    } else {
      // Limpeza segura
      window._eprocClassificacaoAtual = null;
      if ($ && elClassif && $(elClassif).data('select2')) {
        try { $(elClassif).select2('data', null); } catch (e) {}
      }
      if (elClassif) {
        elClassif.value = '';
        elClassif.setAttribute('value', '');
      }
      if (elIds) {
        elIds.value = '';
        elIds.setAttribute('value', '');
      }
      const s2Container = document.getElementById('s2id_selClassificacaoConteudo') || (elClassif && elClassif.closest('div')?.querySelector('.select2-container'));
      if (s2Container) {
        const choicesUl = s2Container.querySelector('ul.select2-choices');
        if (choicesUl) {
          choicesUl.querySelectorAll('li.select2-search-choice').forEach(li => li.remove());
        }
      }
      return false;
    }
  }

  // 3. Cadastra a nova classificação caso não exista na Unidade
  async function criarNovaClassificacaoNoEproc(nomeClassificacao) {
    const nomeLimpo = String(nomeClassificacao || '').trim();
    if (!nomeLimpo) return null;

    const urlListar = obterUrlListarClassificacoes();
    if (!urlListar) return null;

    try {
      addLog(`⚙️ Cadastrando classificação "${nomeLimpo}" no eproc...`, 'info');

      // 1. Acessa a listagem para obter a URL do formulário de cadastro
      const urlListarAbs = new URL(urlListar, window.location.href).href;
      const respListar = await fetch(urlListarAbs, { credentials: 'same-origin' });
      if (!respListar.ok) return null;
      const htmlListar = await lerRespostaTexto(respListar);
      const docListar = new DOMParser().parseFromString(htmlListar, 'text/html');

      let urlCadastrar = null;
      const todosElementos = docListar.querySelectorAll('a, button, input[type="button"], input[type="submit"]');
      for (const el of todosElementos) {
        const href = el.getAttribute('href') || '';
        const onclick = el.getAttribute('onclick') || '';
        const id = el.id || '';
        const val = (el.value || el.textContent || '').trim().toLowerCase();
        const comb = `${href} ${onclick} ${id} ${val}`.toLowerCase();

        if (comb.includes('classificacao_conteudo_cadastrar') ||
            (comb.includes('cadastrar') && comb.includes('classificacao')) ||
            val === 'nova' || val === 'novo' ||
            (comb.includes('nov') && (id.includes('btn') || onclick.includes('controlador') || href.includes('controlador')))) {
          const m = href.match(/controlador\.php\?[^'"\s]+/i) ||
                    onclick.match(/['"](controlador\.php\?[^'"]+)['"]/i) ||
                    onclick.match(/exibirSubFrm\('([^']+)'/i);
          if (m) {
            urlCadastrar = (m[1] || m[0]).replace(/&amp;/g, '&');
            break;
          }
        }
      }

      if (!urlCadastrar) {
        urlCadastrar = urlListar.replace('acao=classificacao_conteudo_listar', 'acao=classificacao_conteudo_cadastrar');
      }

      const urlCadastrarAbs = new URL(urlCadastrar, window.location.href).href;

      // 2. Acessa o formulário de cadastro
      const respForm = await fetch(urlCadastrarAbs, { credentials: 'same-origin' });
      if (!respForm.ok) return null;
      const htmlForm = await lerRespostaTexto(respForm);
      const docForm = new DOMParser().parseFromString(htmlForm, 'text/html');

      const form = docForm.querySelector('form[action*="classificacao_conteudo" i]') || docForm.querySelector('form') || docForm.forms[0];
      if (!form) return null;

      let rawAction = form.getAttribute('action') || '';
      let actionUrl = urlCadastrarAbs;
      if (rawAction && rawAction !== '#' && !rawAction.startsWith('javascript:')) {
        actionUrl = new URL(rawAction, urlCadastrarAbs).href;
      }

      const bodyParams = new URLSearchParams();

      // Copia TODOS os campos hidden com seus valores originais
      form.querySelectorAll('input[type="hidden"]').forEach(inp => {
        if (inp.name) bodyParams.set(inp.name, inp.value);
      });

      // Localiza o botão submit do form e copia seu nome e valor
      const submitBtn = form.querySelector('input[type="submit"], button[type="submit"], input[id*="Salvar" i], button[id*="Salvar" i]');
      if (submitBtn && submitBtn.name) {
        bodyParams.set(submitBtn.name, submitBtn.value || 'Salvar');
      } else {
        bodyParams.set('sbmSalvar', 'Salvar');
        bodyParams.set('btnSalvar', 'Salvar');
      }

      // Preenche todos os campos de texto do formulário com a nova descrição (compatível com emojis via entidades HTML decimais, evitando mojibake UTF-8 vs Latin-1)
      let campoTextoAchado = false;
      const nomeParaEnviar = toHtmlEntityDecimal(nomeLimpo);
      form.querySelectorAll('input[type="text"], input:not([type])').forEach(ti => {
        if (!ti.readOnly && !ti.disabled && ti.name) {
          bodyParams.set(ti.name, nomeParaEnviar);
          campoTextoAchado = true;
        }
      });
      if (!campoTextoAchado) {
        bodyParams.set('txtDescricao', nomeParaEnviar);
      }

      // 3. Submete o cadastro no eproc
      await fetch(actionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: bodyParams.toString(),
        credentials: 'same-origin'
      });

      await sleep(600);

      // 4. Re-carrega tabela atualizada para recuperar o novo ID gerado
      const mapaAtualizado = await carregarTodasClassificacoesDaTabela();
      const chaveExact = nomeLimpo.trim();
      const chaveUpper = nomeLimpo.toUpperCase().trim();
      const chaveNorm = normalizar(nomeLimpo);

      if (mapaAtualizado.has(chaveExact)) {
        const itemCriado = mapaAtualizado.get(chaveExact);
        addLog(`✅ Classificação "${itemCriado.text}" cadastrada com sucesso no eproc!`, 'success');
        return itemCriado;
      }
      if (mapaAtualizado.has(chaveUpper)) {
        const itemCriado = mapaAtualizado.get(chaveUpper);
        addLog(`✅ Classificação "${itemCriado.text}" cadastrada com sucesso no eproc!`, 'success');
        return itemCriado;
      }
      if (mapaAtualizado.has(chaveNorm)) {
        const itemCriado = mapaAtualizado.get(chaveNorm);
        addLog(`✅ Classificação "${itemCriado.text}" cadastrada com sucesso no eproc!`, 'success');
        return itemCriado;
      }

      // 5. Tenta busca Ajax adicional caso a listagem tenha paginação
      await buscarClassificacaoPorAjax(nomeLimpo);
      if (cacheClassificacoesUnidade.has(chaveExact)) {
        const itemCriado = cacheClassificacoesUnidade.get(chaveExact);
        addLog(`✅ Classificação "${itemCriado.text}" localizada após cadastro!`, 'success');
        return itemCriado;
      }
      if (cacheClassificacoesUnidade.has(chaveUpper)) {
        const itemCriado = cacheClassificacoesUnidade.get(chaveUpper);
        addLog(`✅ Classificação "${itemCriado.text}" localizada após cadastro!`, 'success');
        return itemCriado;
      }
      if (cacheClassificacoesUnidade.has(chaveNorm)) {
        const itemCriado = cacheClassificacoesUnidade.get(chaveNorm);
        addLog(`✅ Classificação "${itemCriado.text}" localizada após cadastro!`, 'success');
        return itemCriado;
      }

      return null;
    } catch (err) {
      console.warn('Erro ao cadastrar classificação no eproc:', err);
      return null;
    }
  }

  // 4. Função principal: resolve o ID numérico (via cache, tabela, busca ou auto-cadastro)
  async function resolverIdClassificacao(nomeClassificacao) {
    const raw = String(nomeClassificacao || '').trim();
    if (!raw || raw === '-') return null;

    const chaveExact = raw;
    const chaveUpper = raw.toUpperCase().trim();
    const chaveNorm = normalizar(raw);

    // 1. Cache em memória (prioriza EXATO e UPPER para preservar emojis!)
    if (cacheClassificacoesUnidade.has(chaveExact)) {
      return cacheClassificacoesUnidade.get(chaveExact);
    }
    if (cacheClassificacoesUnidade.has(chaveUpper)) {
      return cacheClassificacoesUnidade.get(chaveUpper);
    }
    if (cacheClassificacoesUnidade.has(chaveNorm)) {
      return cacheClassificacoesUnidade.get(chaveNorm);
    }

    // 2. Tabela oficial de classificações da Unidade
    const mapaTabela = await carregarTodasClassificacoesDaTabela();
    if (mapaTabela.has(chaveExact)) {
      return mapaTabela.get(chaveExact);
    }
    if (mapaTabela.has(chaveUpper)) {
      return mapaTabela.get(chaveUpper);
    }
    if (mapaTabela.has(chaveNorm)) {
      return mapaTabela.get(chaveNorm);
    }

    // 3. Busca direta pelo nome no endpoint AJAX do Select2
    await buscarClassificacaoPorAjax(raw);
    if (cacheClassificacoesUnidade.has(chaveExact)) {
      return cacheClassificacoesUnidade.get(chaveExact);
    }
    if (cacheClassificacoesUnidade.has(chaveUpper)) {
      return cacheClassificacoesUnidade.get(chaveUpper);
    }
    if (cacheClassificacoesUnidade.has(chaveNorm)) {
      return cacheClassificacoesUnidade.get(chaveNorm);
    }

    // 4. Não existe: cadastra automaticamente no eproc
    const criada = await criarNovaClassificacaoNoEproc(raw);
    if (criada) {
      totalClassificacoesCriadasNoLote++;
      return criada;
    }

    return null;
  }

  

  /* ================== FUNÇÕES AUXILIARES 2G: INTIMAÇÃO, REMESSA E GRUPOS ================== */

  /* ===== helpers de agendamento 2G ===== */

  async function esperarCond(fn, ms = 6000, passo = 150) {

    let t = 0;

    while (t < ms) {

      let v = null;

      try { v = fn(); } catch (e) {}

      if (v) return v;

      await sleep(passo); t += passo;

    }

    return null;

  }

  function jqChange(el, valor) {

    const $ = window.jQuery || window.$;

    if (valor !== undefined) el.value = valor;

    if ($) { try { $(el).val(el.value).trigger('change'); return; } catch (e) {} }

    dispararEventos(el, ['input', 'change']);

  }

  function listarIdsDiag(raiz, prefixos) {

    const r = raiz || document;

    return Array.from(r.querySelectorAll('[id]')).map(e => e.id).filter(id => prefixos.some(p => id.startsWith(p))).slice(0, 40).join(', ') || '(nenhum)';

  }

  function opcaoPorTexto(sel, desejado, extras = []) {

    const n = normalizar(desejado);

    const opts = Array.from(sel.options).filter(o => o.value && o.value !== 'null');

    let o = opts.find(x => normalizar(x.text) === n);

    if (!o) o = opts.find(x => normalizar(x.text).includes(n) || n.includes(normalizar(x.text)));

    if (!o) {

      for (const ex of extras) {

        o = opts.find(x => ex.every(k => normalizar(x.text).includes(k)));

        if (o) break;

      }

    }

    return o || null;

  }

  async function ativarCheckboxNativo(chk, tipo) {

    if (!chk.checked) {

      chk.click(); // clique nativo: alterna e dispara os handlers do eproc

      await sleep(300);

    }

    if (!chk.checked) {

      chk.checked = true;

      dispararEventos(chk, ['change']);

    }

    return chk.checked;

  }



  async function configurarIntimacaoPartes2G(item, dados) {

    if (!item.intimarPartes) return false;

    addLog('Configurando Agendamento de Intimação das Partes...');



    const chk = await esperarCond(() => document.getElementById('chkEncadeamentoIntimar'), 6000);

    if (!chk) {

      addLog('⚠️ "chkEncadeamentoIntimar" não apareceu. IDs presentes: ' + listarIdsDiag(document, ['chkEnc', 'selEventoEnc', 'divExibe', 'divTipo']), 'warn');

      return false;

    }

    destacarCampoAtivo(chk, 'Intimar Partes', 'Marcando...');

    await ativarCheckboxNativo(chk, 'I');



    let sel = await esperarCond(() => {

      const s = document.getElementById('selEventoEncadeadoCitacaoIntimacao');

      return (s && s.options.length > 1) ? s : null;

    }, 4000);

    if (!sel && typeof window.encadearEvento === 'function') {

      try { window.encadearEvento({ target: chk }, 'I', ''); } catch (e) {}

      sel = await esperarCond(() => {

        const s = document.getElementById('selEventoEncadeadoCitacaoIntimacao');

        return (s && s.options.length > 1) ? s : null;

      }, 6000);

    }

    if (!sel) {

      addLog('⚠️ Select de evento de intimação não carregou. IDs: ' + listarIdsDiag(document, ['selEventoEnc', 'divTipoEvento', 'divExibeHtmlCit']), 'warn');

      return false;

    }



    const opt = opcaoPorTexto(sel, item.eventoIntimacao || '', [['despacho'], ['custas'], ['vista', 'mp']]);

    if (!opt) {

      addLog('⚠️ Evento de intimação "' + item.eventoIntimacao + '" não encontrado. Opções: ' + Array.from(sel.options).map(o => o.text.trim()).slice(0, 12).join(' | '), 'warn');

      return false;

    }

    destacarCampoAtivo(sel, 'Evento de Intimação', opt.text.trim());

    jqChange(sel, opt.value);

    window._eprocEventoIntimacaoId = opt.value;

    addLog('✓ Evento de intimação: "' + opt.text.trim() + '"');

    await esperarCond(() => { const im = document.getElementById('imgLoadingEventoEncadeadoCitacaoIntimacao'); return !im || im.style.display === 'none' || !im.offsetParent; }, 8000);

    await sleep(500);



    // Aguarda carregar as opções avançadas (prazos por tipo de parte)

    const rdo = await esperarCond(() => document.getElementById('porTipoDeParte'), 8000);

    if (!rdo) {

      addLog('⚠️ Opções avançadas de intimação não carregaram. IDs: ' + listarIdsDiag(document, ['por', 'chkSel', 'txtPrazo']), 'warn');

      return false;

    }

    if (!rdo.checked) { rdo.click(); await sleep(300); }

    if (!rdo.checked) { rdo.checked = true; dispararEventos(rdo, ['change']); }

    await sleep(300);



    const campos = [

      ['chkSelEntPrazoEspecial', 'txtPrazoEntPrazoEspecial', item.prazoEspecial || 30],

      ['chkSelEntPrazoSimples', 'txtPrazoEntPrazoSimples', item.prazoSimples || 15],

      ['chkSelNaoEntPrazoSimples', 'txtPrazoNaoEntPrazoSimples', item.prazoPartes || 15],

      ['chkSelDPU', 'txtPrazoDPU', item.prazoDPU || 30]

    ];

    for (const [idChk, idTxt, dias] of campos) {

      const c = document.getElementById(idChk);

      const t = document.getElementById(idTxt);

      if (c && !c.checked) { c.click(); await sleep(120); if (!c.checked) { c.checked = true; dispararEventos(c, ['change']); } }

      if (t) { t.disabled = false; t.value = String(dias); dispararEventos(t, ['input', 'change']); }

      if (!c && !t) addLog('⚠️ Campos de prazo ' + idChk + '/' + idTxt + ' não encontrados.', 'warn');

    }

    dados.intimacao = 'Sim (Esp:' + (item.prazoEspecial || 30) + 'd, Simp:' + (item.prazoSimples || 15) + 'd, Partes:' + (item.prazoPartes || 15) + 'd, DPU:' + (item.prazoDPU || 30) + 'd)';

    addLog('✓ Agendamento de Intimação configurado (' + dados.intimacao + ')');

    return true;

  }



  async function configurarRemessaProcesso2G(item, dados) {

    if (!item.remeterProcesso) return false;

    addLog('Configurando Agendamento de Remessa do Processo...');



    const chk = await esperarCond(() => document.getElementById('chkEncadeamentoRemessa'), 6000);

    if (!chk) {

      addLog('⚠️ "chkEncadeamentoRemessa" não apareceu. IDs presentes: ' + listarIdsDiag(document, ['chkEnc', 'selEventoEnc', 'divExibe', 'divTipo']), 'warn');

      return false;

    }

    destacarCampoAtivo(chk, 'Remeter Processo', 'Marcando...');

    await ativarCheckboxNativo(chk, 'R');



    let sel = await esperarCond(() => {

      const s = document.getElementById('selEventoEncadeadoRemessa');

      return (s && s.options.length > 1) ? s : null;

    }, 4000);

    if (!sel && typeof window.encadearEvento === 'function') {

      try { window.encadearEvento({ target: chk }, 'R', ''); } catch (e) {}

      sel = await esperarCond(() => {

        const s = document.getElementById('selEventoEncadeadoRemessa');

        return (s && s.options.length > 1) ? s : null;

      }, 6000);

    }

    if (!sel) {

      addLog('⚠️ Select de evento de remessa não carregou. IDs: ' + listarIdsDiag(document, ['selEventoEnc', 'divTipoEvento', 'divExibeHtmlRem']), 'warn');

      return false;

    }



    const opt = opcaoPorTexto(sel, item.eventoRemessa || '', [['remetidos'], ['remessa']]);

    if (!opt) {

      addLog('⚠️ Evento de remessa "' + item.eventoRemessa + '" não encontrado. Opções: ' + Array.from(sel.options).map(o => o.text.trim()).slice(0, 12).join(' | '), 'warn');

      return false;

    }

    destacarCampoAtivo(sel, 'Evento de Remessa', opt.text.trim());

    jqChange(sel, opt.value);

    window._eprocEventoRemessaId = opt.value;

    addLog('✓ Evento de remessa: "' + opt.text.trim() + '"');



    const selOrg = await esperarCond(() => {

      const s = document.getElementById('selOrgao');

      return (s && s.options.length > 1) ? s : null;

    }, 8000);

    if (!selOrg) {

      addLog('⚠️ Combo de órgão (selOrgao) não carregou. IDs: ' + listarIdsDiag(document, ['selOrg', 'divDadosRem']), 'warn');

      return false;

    }

    const oOrg = opcaoPorTexto(selOrg, item.orgaoRemessa || '', [['dpbupj'], ['unidade', 'processamento']]);

    if (!oOrg) {

      addLog('⚠️ Órgão "' + item.orgaoRemessa + '" não encontrado. Opções: ' + Array.from(selOrg.options).map(o => o.text.trim()).slice(0, 12).join(' | '), 'warn');

      return false;

    }

    destacarCampoAtivo(selOrg, 'Órgão de Remessa', oOrg.text.trim());

    jqChange(selOrg, oOrg.value);

    window._eprocOrgaoRemessaId = oOrg.value;

    dados.remessa = oOrg.text.trim();

    addLog('✓ Órgão de destino da remessa: "' + dados.remessa + '"');

    await sleep(500);

    return true;

  }



  async function desativarIntimacaoPartes2G() {

    try {

      window.carregarPreferencias = false;

      window.mc_chkEncadeamentoIntimar = '';

      window._eprocEventoIntimacaoId = null;

      if (window.arrCamposPersonalizados && typeof window.arrCamposPersonalizados === 'object') {

        window.arrCamposPersonalizados.chkEncadeamentoIntimar = 'N';

      }

      const chk = document.getElementById('chkEncadeamentoIntimar');

      if (chk) {

        if (chk.checked) {

          chk.click();

          await sleep(150);

        }

        chk.checked = false;

        chk.removeAttribute('checked');

        if (typeof window.alterarIntimar === 'function') {

          try { window.alterarIntimar(false); } catch (e) {}

        }

        if (typeof window.encadearEvento === 'function') {

          try { window.encadearEvento({ target: chk }, 'T', 1, ''); } catch (e) {}

        }

        dispararEventos(chk, ['change']);

      }

      const divCit = document.getElementById('divExibeHtmlCitacaoIntimacao');

      if (divCit) divCit.style.display = 'none';

      const sel = document.getElementById('selEventoEncadeadoCitacaoIntimacao');

      if (sel) {

        sel.value = 'null';

        dispararEventos(sel, ['change']);

      }

      const chksPrazos = [

        'chkSelEntPrazoEspecial', 'chkSelEntPrazoSimples',

        'chkSelNaoEntPrazoSimples', 'chkSelDPU',

        'chkSelPrazoAutores', 'chkSelPrazoReus', 'chkSelTodosPolo'

      ];

      chksPrazos.forEach(id => {

        const el = document.getElementById(id);

        if (el && el.checked) {

          el.checked = false;

          dispararEventos(el, ['change']);

        }

      });

    } catch (e) {

      console.warn('Erro ao desativar intimação 2G:', e);

    }

  }



  async function desativarRemessaProcesso2G() {

    try {

      window._eprocEventoRemessaId = null;

      window._eprocOrgaoRemessaId = null;

      if (window.arrCamposPersonalizados && typeof window.arrCamposPersonalizados === 'object') {

        window.arrCamposPersonalizados.chkEncadeamentoRemessa = 'N';

      }

      const chk = document.getElementById('chkEncadeamentoRemessa');

      if (chk) {

        if (chk.checked) {

          chk.click();

          await sleep(150);

        }

        chk.checked = false;

        chk.removeAttribute('checked');

        if (typeof window.encadearEvento === 'function') {

          try { window.encadearEvento({ target: chk }, 'R', 1, ''); } catch (e) {}

        }

        dispararEventos(chk, ['change']);

      }

      const divRem = document.getElementById('divExibeHtmlRemessa');

      if (divRem) divRem.style.display = 'none';

      const sel = document.getElementById('selEventoEncadeadoRemessa');

      if (sel) {

        sel.value = 'null';

        dispararEventos(sel, ['change']);

      }

      const selOrg = document.getElementById('selOrgao');

      if (selOrg) {

        selOrg.value = 'null';

        dispararEventos(selOrg, ['change']);

      }

    } catch (e) {

      console.warn('Erro ao desativar remessa 2G:', e);

    }

  }



  function intimacaoOk2G(item) {

    const c = document.getElementById('chkEncadeamentoIntimar');

    const s = document.getElementById('selEventoEncadeadoCitacaoIntimacao');

    const r = document.getElementById('porTipoDeParte');

    if (!(c && c.checked && s && s.value && s.value !== 'null' && r && r.checked)) return false;

    const campos = [

      ['chkSelEntPrazoEspecial', 'txtPrazoEntPrazoEspecial', item.prazoEspecial || 30],

      ['chkSelEntPrazoSimples', 'txtPrazoEntPrazoSimples', item.prazoSimples || 15],

      ['chkSelNaoEntPrazoSimples', 'txtPrazoNaoEntPrazoSimples', item.prazoPartes || 15],

      ['chkSelDPU', 'txtPrazoDPU', item.prazoDPU || 30]

    ];

    for (const [ic, it, d] of campos) {

      const cc = document.getElementById(ic), tt = document.getElementById(it);

      if (cc && !cc.checked) return false;

      if (tt && String(tt.value) !== String(d)) return false;

    }

    return true;

  }



  // Revalida (e reaplica se necessário) os agendamentos imediatamente antes de salvar

  async function garantirAgendamentos2G(item, dados) {

    if (item.intimarPartes) {

      for (let k = 0; k < 3 && !intimacaoOk2G(item); k++) {

        addLog('↻ Intimação incompleta/perdida; reaplicando (' + (k + 1) + ')...', 'warn');

        await configurarIntimacaoPartes2G(item, dados);

        await sleep(300);

      }

    } else {

      await desativarIntimacaoPartes2G();

    }

    if (item.remeterProcesso) {

      const ok = () => {

        const c = document.getElementById('chkEncadeamentoRemessa');

        const s = document.getElementById('selEventoEncadeadoRemessa');

        const o = document.getElementById('selOrgao');

        return c && c.checked && s && s.value && s.value !== 'null' && o && o.value && o.value !== 'null';

      };

      for (let k = 0; k < 3 && !ok(); k++) {

        addLog('↻ Remessa incompleta/perdida; reaplicando (' + (k + 1) + ')...', 'warn');

        await configurarRemessaProcesso2G(item, dados);

        await sleep(300);

      }

    } else {

      await desativarRemessaProcesso2G();

    }

    // Se o item for apenas de remessa (sem intimação), reforça desmarcação de intimação após o AJAX da remessa
    if (!item.intimarPartes) {

      await desativarIntimacaoPartes2G();

    }

  }



  const cacheGruposRelatorio = new Map();



  function toHtmlEntityDecimal(str) {

    if (!str) return '';

    if (typeof window.toHtmlEntityDecimal === 'function') {

      try { return window.toHtmlEntityDecimal(str); } catch (e) {}

    }

    return Array.from(str).map(ch => {

      const cp = ch.codePointAt(0);

      return cp > 127 ? '&#' + cp + ';' : ch;

    }).join('');

  }



  
  /* ================== BUSCA DINÂMICA DO USUÁRIO LOGADO PARA VINCULAÇÃO EM GRUPO ================== */
  let _cacheUsuarioLogado = null;

  function extrairUsuarioLogadoDom(docContexto) {
    let nomeCompleto = '';
    let sigla = '';
    let matricula = '';

    const docs = [document];
    if (docContexto && docContexto !== document) docs.push(docContexto);

    for (const d of docs) {
      // 1. Extrai do painel de perfil da barra superior (#nav-profile .header span)
      const spans = d.querySelectorAll('#nav-profile .header span, #frmProfile #nav-profile span, #nav-profile span, .profile-body .header span');
      for (const sp of spans) {
        const txt = (sp.textContent || '').replace(/\s+/g, ' ').trim();
        if (!txt) continue;
        const m = txt.match(/^(.+?)\s*\(([A-Za-z0-9_.-]+)\)\s*$/);
        if (m) {
          nomeCompleto = m[1].trim();
          sigla = m[2].trim();
          break;
        }
      }
      if (nomeCompleto && sigla) break;
    }

    // 2. Fallback: extrai a sigla/matrícula de #hdnInfraPrefixoCookie (ex: "TJSP_Eproc_SGS370712")
    if (!sigla) {
      for (const d of docs) {
        const inpCookie = d.getElementById ? d.getElementById('hdnInfraPrefixoCookie') : d.querySelector('#hdnInfraPrefixoCookie');
        if (inpCookie && inpCookie.value) {
          const val = String(inpCookie.value).trim();
          const partes = val.split('_');
          const candidato = partes[partes.length - 1] || '';
          if (candidato && /[A-Za-z]*\d{3,}/i.test(candidato)) {
            sigla = candidato.trim();
            break;
          }
        }
      }
    }

    if (sigla) {
      const mNum = sigla.match(/\d{3,}/);
      if (mNum) matricula = mNum[0];
    }

    const partesNome = nomeCompleto ? nomeCompleto.split(/\s+/).filter(p => p.length > 2) : [];
    const primeiroNome = partesNome.length > 0 ? partesNome[0] : '';
    const ultimoNome = partesNome.length > 1 ? partesNome[partesNome.length - 1] : '';

    return {
      nomeCompleto,
      sigla,
      matricula,
      primeiroNome,
      ultimoNome,
      rotulo: nomeCompleto && sigla ? `${nomeCompleto} (${sigla})` : (nomeCompleto || sigla || 'Usuário Logado')
    };
  }

  function correspondeAoUsuarioLogado(desc, id, comp, perfil) {
    const descNorm = normalizar(desc || '');
    const compNorm = normalizar(comp || '');
    const idStr = String(id || '');

    if (perfil.nomeCompleto) {
      const nomeNorm = normalizar(perfil.nomeCompleto);
      if (nomeNorm && descNorm.includes(nomeNorm)) return true;
    }
    if (perfil.sigla) {
      const siglaNorm = normalizar(perfil.sigla);
      if (siglaNorm && (descNorm.includes(siglaNorm) || compNorm.includes(siglaNorm))) return true;
    }
    if (perfil.matricula && perfil.matricula.length >= 4) {
      if ((desc && desc.includes(perfil.matricula)) || (comp && comp.includes(perfil.matricula)) || idStr.includes(perfil.matricula)) {
        return true;
      }
    }
    if (perfil.primeiroNome && perfil.ultimoNome) {
      const pNorm = normalizar(perfil.primeiroNome);
      const uNorm = normalizar(perfil.ultimoNome);
      if (pNorm && uNorm && descNorm.includes(pNorm) && descNorm.includes(uNorm)) {
        return true;
      }
    }
    return false;
  }

  async function buscarDadosUsuarioLogado(htmlContexto) {
    if (_cacheUsuarioLogado && _cacheUsuarioLogado.id) {
      return _cacheUsuarioLogado;
    }

    let docAux = null;
    if (htmlContexto) {
      try {
        docAux = new DOMParser().parseFromString(htmlContexto, 'text/html');
      } catch (e) {}
    }

    const perfil = extrairUsuarioLogadoDom(docAux);
    const termosBrutos = [
      perfil.nomeCompleto,
      perfil.sigla,
      perfil.matricula,
      perfil.primeiroNome && perfil.ultimoNome ? `${perfil.primeiroNome} ${perfil.ultimoNome}` : '',
      perfil.primeiroNome
    ];
    const termos = [];
    termosBrutos.forEach(t => {
      const limpo = String(t || '').trim();
      if (limpo && limpo.length >= 3 && !termos.includes(limpo)) {
        termos.push(limpo);
      }
    });

    // 1. Tenta buscar via controlador_ajax.php?acao_ajax=buscar_usuarios_orgao
    try {
      let urlAjax = null;
      if (htmlContexto) {
        const m = htmlContexto.match(/controlador_ajax\.php\?acao_ajax=buscar_usuarios_orgao[^'"]*/i);
        if (m) urlAjax = m[0].replace(/&amp;/g, '&');
      }
      if (!urlAjax) {
        const hashAtual = typeof obterHashAtual === 'function' ? obterHashAtual() : '';
        if (hashAtual) {
          urlAjax = 'controlador_ajax.php?acao_ajax=buscar_usuarios_orgao&hash=' + hashAtual;
        }
      }

      if (urlAjax && termos.length > 0) {
        const fullUrl = new URL(urlAjax, window.location.href).href;
        for (const termo of termos) {
          const resp = await fetch(fullUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'X-Requested-With': 'XMLHttpRequest'
            },
            body: 'palavra_pesquisa=' + encodeURIComponent(termo) + '&q=' + encodeURIComponent(termo) + '&ids=',
            credentials: 'same-origin'
          });

          if (resp.ok) {
            const txt = await resp.text();
            if (txt.includes('<item')) {
              const parser = new DOMParser();
              const xmlDoc = parser.parseFromString(txt, 'text/xml');
              const items = xmlDoc.querySelectorAll('item');
              for (const it of items) {
                const desc = it.getAttribute('descricao') || '';
                const id = it.getAttribute('id') || '';
                const comp = it.getAttribute('complemento') || '';
                if (correspondeAoUsuarioLogado(desc, id, comp, perfil) || (items.length === 1 && id)) {
                  _cacheUsuarioLogado = { id: String(id), nome: desc || perfil.nomeCompleto || perfil.sigla, complemento: comp, perfil };
                  addLog('👤 Usuário logado identificado no órgão: "' + _cacheUsuarioLogado.nome + '" (ID: ' + id + ')');
                  return _cacheUsuarioLogado;
                }
              }
            } else if (txt.startsWith('[') || txt.startsWith('{')) {
              try {
                const dados = JSON.parse(txt);
                const lista = Array.isArray(dados) ? dados : (dados.itens || dados.items || []);
                for (const u of lista) {
                  const desc = u.descricao || u.NomePessoa || u.nome || u.label || '';
                  const id = u.id || u.IdUsuario || u.value || '';
                  const comp = u.complemento || u.DesTipoUsuario || '';
                  if (correspondeAoUsuarioLogado(desc, id, comp, perfil) || (lista.length === 1 && id)) {
                    _cacheUsuarioLogado = { id: String(id), nome: desc || perfil.nomeCompleto || perfil.sigla, complemento: comp, perfil };
                    addLog('👤 Usuário logado identificado no órgão: "' + _cacheUsuarioLogado.nome + '" (ID: ' + id + ')');
                    return _cacheUsuarioLogado;
                  }
                }
              } catch (eJson) {}
            }
          }
        }
      }
    } catch (eAjax) {
      console.warn('Erro ao buscar usuário logado via buscar_usuarios_orgao:', eAjax);
    }

    // 2. Tenta buscar via controlador.php?acao=relatorio_geral/listar_usuarios
    try {
      const linkListar = document.documentElement.innerHTML.match(/controlador\.php\?acao=relatorio_geral\/listar_usuarios[^'"]*/i);
      if (linkListar && termos.length > 0) {
        const urlListarUsers = new URL(linkListar[0].replace(/&amp;/g, '&'), window.location.href).href;
        for (const termo of termos) {
          const respU = await fetch(urlListarUsers, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'X-Requested-With': 'XMLHttpRequest'
            },
            body: 'term=' + encodeURIComponent(termo),
            credentials: 'same-origin'
          });
          if (respU.ok) {
            const jsonU = await respU.json();
            const listaU = Array.isArray(jsonU) ? jsonU : (jsonU.itens || []);
            const achouU = listaU.find(u =>
              correspondeAoUsuarioLogado(u.NomePessoa || u.descricao || '', u.IdUsuario || u.id || '', u.DesTipoUsuario || u.complemento || '', perfil)
            );
            if (achouU) {
              _cacheUsuarioLogado = {
                id: String(achouU.IdUsuario || achouU.id),
                nome: achouU.NomePessoa || achouU.descricao || perfil.nomeCompleto || perfil.sigla,
                complemento: achouU.DesTipoUsuario || achouU.complemento || '',
                perfil
              };
              addLog('👤 Usuário logado identificado no órgão: "' + _cacheUsuarioLogado.nome + '" (ID: ' + _cacheUsuarioLogado.id + ')');
              return _cacheUsuarioLogado;
            }
          }
        }
      }
    } catch (eU) {
      console.warn('Erro ao buscar usuário logado via listar_usuarios:', eU);
    }

    return { id: '', nome: perfil.nomeCompleto || perfil.sigla || 'Usuário Logado', complemento: '', perfil };
  }

  /* ================== GERENCIAR GRUPO DE PREFERÊNCIAS 2G ================== */

  async function obterGruposCadastradosNoEproc2G() {
    const mapa = new Map();

    // 1. Carrega grupos previamente gravados em cache
    if (typeof cacheGruposRelatorio !== 'undefined' && cacheGruposRelatorio && cacheGruposRelatorio.size > 0) {
      cacheGruposRelatorio.forEach((v, k) => {
        if (v && v !== 'null') mapa.set(k, v);
      });
    }

    // 2. Selects de grupos disponíveis no DOM ativo (#Grupo ou #selFormularioPersonalizacaoGrupo)
    const selGrupo = document.getElementById('Grupo') || document.getElementById('selFormularioPersonalizacaoGrupo');
    if (selGrupo && selGrupo.options) {
      Array.from(selGrupo.options).forEach(opt => {
        const txt = (opt.text || '').trim();
        const val = (opt.value || '').trim();
        if (val && val !== 'null' && val !== '0' && txt && !txt.toLowerCase().includes('selecione')) {
          const norm = normalizar(txt);
          mapa.set(norm, val);
          if (typeof cacheGruposRelatorio !== 'undefined' && cacheGruposRelatorio) {
            cacheGruposRelatorio.set(norm, val);
          }
        }
      });
    }

    // 3. Consulta rápida com timeout à tela oficial de listagem de grupos do eproc 2G
    try {
      let linkMenu = document.querySelector('a[href*="acao=listar_formulario_personalizacao_grupo"]');
      let urlListar = linkMenu ? linkMenu.getAttribute('href') : null;
      if (!urlListar) {
        const hashAtual = typeof obterHashAtual === 'function' ? obterHashAtual() : '';
        if (hashAtual) {
          urlListar = 'controlador.php?acao=listar_formulario_personalizacao_grupo&hash=' + hashAtual;
        }
      }

      if (urlListar) {
        urlListar = urlListar.replace(/&amp;/g, '&');
        // Só consulta se possuir um hash válido de segurança
        if (/[?&]hash=[a-f0-9]{16,}/i.test(urlListar)) {
          const promListar = (async () => {
            try {
              const resp = await fetch(urlListar, { credentials: 'same-origin' });
              if (resp.ok) {
                const html = await resp.text();
                const doc = new DOMParser().parseFromString(html, 'text/html');
                doc.querySelectorAll('tr').forEach(tr => {
                  const tds = tr.querySelectorAll('td');
                  if (tds.length >= 2) {
                    const nome = (tds[0].textContent || tds[1].textContent || '').trim();
                    const m = tr.innerHTML.match(/id_formulario_personalizacao_grupo=(\d+)/i) ||
                              tr.innerHTML.match(/id_grupo=(\d+)/i) ||
                              tr.innerHTML.match(/valor=(\d+)/i);
                    const id = m ? m[1] : '';
                    if (nome) {
                      const norm = normalizar(nome);
                      mapa.set(norm, id || true);
                      if (id && typeof cacheGruposRelatorio !== 'undefined' && cacheGruposRelatorio) {
                        cacheGruposRelatorio.set(norm, id);
                      }
                    }
                  }
                });
              }
            } catch (eF) {
              console.warn('Erro fetch listar grupos:', eF);
            }
          })();

          // Trava de segurança: no máximo 2 segundos para nunca travar a tela
          await Promise.race([promListar, sleep(2000)]);
        }
      }
    } catch (e) {
      console.warn('Erro ao obter grupos cadastrados no eproc 2G:', e);
    }

    return mapa;
  }

  async function gerenciarGrupoPreferencia2G(nomeGrupo) {
    const raw = String(nomeGrupo || '').trim();
    if (!raw || raw === '-') return null;

    const norm = normalizar(raw);

    // 1. Se existir o select na tela (Nova Minuta), confere as options
    const selGrupo = document.getElementById('selFormularioPersonalizacaoGrupo');
    if (selGrupo) {
      selGrupo.disabled = false;
      if (window.$) $(selGrupo).prop('disabled', false);
      let opt = Array.from(selGrupo.options).find(o => normalizar(o.text) === norm || normalizar(o.text).includes(norm));
      if (opt && opt.value && opt.value !== 'null') {
        selGrupo.value = opt.value;
        dispararEventos(selGrupo, ['change']);
        window._eprocGrupoAtualId = opt.value;
        cacheGruposRelatorio.set(norm, opt.value);
        return { id: opt.value, text: opt.text.trim() };
      }
    }

    // 2. Se já estiver no cache com ID válido
    if (cacheGruposRelatorio.has(norm)) {
      const cId = cacheGruposRelatorio.get(norm);
      if (cId) {
        return { id: String(cId), text: raw };
      }
      cacheGruposRelatorio.delete(norm);
    }

    // 3. Busca ou cadastra no eproc 2G via tela oficial de Grupos de Preferências
    addLog('ℹ️ Grupo "' + raw + '": verificando cadastro e vinculação de usuário no eproc 2G...');
    try {
      let linkMenuGrupo = document.querySelector('a[href*="acao=listar_formulario_personalizacao_grupo"]');
      let urlListar = linkMenuGrupo ? linkMenuGrupo.getAttribute('href') : null;

      if (!urlListar) {
        const hashAtual = typeof obterHashAtual === 'function' ? obterHashAtual() : '';
        if (hashAtual) {
          urlListar = 'controlador.php?acao=listar_formulario_personalizacao_grupo&hash=' + hashAtual;
        }
      }

      if (urlListar) {
        urlListar = urlListar.replace(/&amp;/g, '&');
        const respListar = await fetch(urlListar, { credentials: 'same-origin' });
        if (respListar.ok) {
          const htmlListar = await lerRespostaTexto(respListar);
          const docListar = new DOMParser().parseFromString(htmlListar, 'text/html');

          let idExistente = null;
          let urlEditarExistente = null;

          docListar.querySelectorAll('tr').forEach(tr => {
            const tds = tr.querySelectorAll('td');
            if (tds.length >= 2) {
              const matchedTd = Array.from(tds).find(td => {
                const t = normalizar(td.textContent.trim());
                return t === norm || t.includes(norm);
              });
              if (matchedTd) {
                const linkEdit = tr.querySelector('a[href*="cadastrar_formulario_personalizacao_grupo"], a[href*="id_formulario_personalizacao_grupo"]') ||
                                 tr.querySelector('a[title*="Alterar"], a[title*="Editar"]');
                if (linkEdit && linkEdit.getAttribute('href')) {
                  urlEditarExistente = linkEdit.getAttribute('href');
                }
                const m = tr.innerHTML.match(/id_formulario_personalizacao_grupo=(\d+)/i) ||
                          tr.innerHTML.match(/id_grupo=(\d+)/i) ||
                          tr.innerHTML.match(/valor=(\d+)/i);
                if (m) {
                  idExistente = m[1];
                } else {
                  const chk = tr.querySelector('input[type="checkbox"]');
                  if (chk && chk.value) {
                    idExistente = chk.value;
                  }
                }
              }
            }
          });

          // Se já existe na tabela de grupos, garante que o usuário logado está vinculado ao grupo
          if (idExistente) {
            let urlEdit = urlEditarExistente;
            if (!urlEdit) {
              const hashAtual = typeof obterHashAtual === 'function' ? obterHashAtual() : '';
              if (hashAtual) {
                urlEdit = 'controlador.php?acao=cadastrar_formulario_personalizacao_grupo&id_formulario_personalizacao_grupo=' + idExistente + '&hash=' + hashAtual;
              }
            }

            if (urlEdit) {
              try {
                const respEdit = await fetch(new URL(urlEdit, window.location.href).href, { credentials: 'same-origin' });
                if (respEdit.ok) {
                  const htmlEdit = await lerRespostaTexto(respEdit);
                  const docEdit = new DOMParser().parseFromString(htmlEdit, 'text/html');
                  const formEdit = docEdit.querySelector('form[action*="salvar_formulario_personalizacao_grupo"]') || docEdit.querySelector('form');

                  const dadosUsuario = await buscarDadosUsuarioLogado(htmlEdit);
                  const perfilLogado = (dadosUsuario && dadosUsuario.perfil) ? dadosUsuario.perfil : extrairUsuarioLogadoDom(docEdit);

                  const iptUsers = formEdit ? formEdit.querySelector('#iptUsuariosGrupo') : null;
                  const tblUsers = docEdit.getElementById('tblUsuarios');
                  const idsAtuais = (iptUsers && iptUsers.value)
                    ? iptUsers.value.split('-').map(s => s.trim()).filter(Boolean)
                    : [];

                  const jaPossuiUsuarioLogado =
                    (dadosUsuario && dadosUsuario.id && idsAtuais.includes(String(dadosUsuario.id))) ||
                    (tblUsers && correspondeAoUsuarioLogado(tblUsers.textContent || '', '', '', perfilLogado));

                  if (!jaPossuiUsuarioLogado && formEdit) {
                    addLog('👤 Vinculando usuário logado "' + perfilLogado.rotulo + '" ao grupo "' + raw + '"...');

                    const actionUrl = new URL(formEdit.getAttribute('action'), window.location.href).href;
                    const params = new URLSearchParams();
                    formEdit.querySelectorAll('input[type="hidden"]').forEach(inp => {
                      if (inp.name) params.set(inp.name, inp.value);
                    });
                    params.set('hdnInfraTipoPagina', '1');
                    params.set('iptDescricaoGrupo', raw);
                    params.set('iptIdFormularioPersonalizacaoGrupo', idExistente);

                    // Preserva usuários já existentes no grupo e acrescenta o usuário logado
                    idsAtuais.forEach(idExist => params.append('arrIdUsuarios[]', idExist));

                    if (dadosUsuario && dadosUsuario.id) {
                      params.set('iptNomeUsuario', dadosUsuario.nome);
                      params.set('iptIdUsuario', dadosUsuario.id);
                      params.set('iptComplementoUsuario', dadosUsuario.complemento || '');
                      const novosIds = idsAtuais.includes(String(dadosUsuario.id)) ? idsAtuais : [...idsAtuais, String(dadosUsuario.id)];
                      params.set('iptUsuariosGrupo', novosIds.join('-') + '-');
                      if (!idsAtuais.includes(String(dadosUsuario.id))) {
                        params.append('arrIdUsuarios[]', dadosUsuario.id);
                      }
                    } else {
                      params.set('iptNomeUsuario', perfilLogado.nomeCompleto || perfilLogado.sigla || 'Usuário Logado');
                      params.set('iptIdUsuario', '1');
                      params.set('iptComplementoUsuario', '');
                      params.set('iptUsuariosGrupo', (iptUsers && iptUsers.value ? iptUsers.value : '') + '1-');
                      params.append('arrIdUsuarios[]', '1');
                    }

                    const respSave = await fetch(actionUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                      body: params.toString(),
                      credentials: 'same-origin'
                    });

                    if (respSave.ok) {
                      addLog('✅ Usuário "' + perfilLogado.rotulo + '" vinculado ao grupo "' + raw + '"!', 'success');
                    }
                  }
                }
              } catch (errEdit) {
                console.warn('Erro ao atualizar usuário no grupo existente:', errEdit);
              }
            }
          }

          // Se não existe na tabela, cadastra acessando o formulário Novo com o usuário logado vinculado
          if (!idExistente) {
            addLog('⚙️ Cadastrando novo Grupo de Preferências "' + raw + '" no eproc 2G...');
            const linkNovo = docListar.querySelector('a[href*="acao=cadastrar_formulario_personalizacao_grupo"], button[onclick*="cadastrar_formulario_personalizacao_grupo"]');
            let urlNovo = linkNovo ? (linkNovo.getAttribute('href') || linkNovo.getAttribute('onclick')) : null;
            if (urlNovo && urlNovo.includes("'")) {
              const mUrl = urlNovo.match(/'([^']+)'/);
              if (mUrl) urlNovo = mUrl[1];
            }

            if (!urlNovo) {
              const hashAtual = typeof obterHashAtual === 'function' ? obterHashAtual() : '';
              if (hashAtual) {
                urlNovo = 'controlador.php?acao=cadastrar_formulario_personalizacao_grupo&hash=' + hashAtual;
              }
            }

            if (urlNovo) {
              const respNovo = await fetch(new URL(urlNovo, window.location.href).href, { credentials: 'same-origin' });
              if (respNovo.ok) {
                const htmlNovo = await lerRespostaTexto(respNovo);
                const docNovo = new DOMParser().parseFromString(htmlNovo, 'text/html');
                const formNovo = docNovo.querySelector('form[action*="salvar_formulario_personalizacao_grupo"]') || docNovo.querySelector('form');

                const dadosUsuario = await buscarDadosUsuarioLogado(htmlNovo);
                const perfilLogado = (dadosUsuario && dadosUsuario.perfil) ? dadosUsuario.perfil : extrairUsuarioLogadoDom(docNovo);
                addLog('🔍 Vinculando usuário logado "' + perfilLogado.rotulo + '" ao novo grupo...');

                if (formNovo) {
                  const actionUrl = new URL(formNovo.getAttribute('action'), window.location.href).href;
                  const params = new URLSearchParams();
                  formNovo.querySelectorAll('input[type="hidden"]').forEach(inp => {
                    if (inp.name) params.set(inp.name, inp.value);
                  });
                  params.set('hdnInfraTipoPagina', '1');
                  params.set('iptDescricaoGrupo', raw);
                  params.set('iptIdFormularioPersonalizacaoGrupo', '');
                  if (dadosUsuario && dadosUsuario.id) {
                    params.set('iptNomeUsuario', dadosUsuario.nome);
                    params.set('iptIdUsuario', dadosUsuario.id);
                    params.set('iptComplementoUsuario', dadosUsuario.complemento || '');
                    params.set('iptUsuariosGrupo', dadosUsuario.id + '-');
                    params.append('arrIdUsuarios[]', dadosUsuario.id);
                  } else {
                    params.set('iptNomeUsuario', perfilLogado.nomeCompleto || perfilLogado.sigla || 'Usuário Logado');
                    params.set('iptIdUsuario', '1');
                    params.set('iptComplementoUsuario', '');
                    params.set('iptUsuariosGrupo', '1-');
                    params.append('arrIdUsuarios[]', '1');
                  }
                  params.set('iptPreferenciasGrupo', '');
                  params.set('iptPreferenciasAutomatizacaoGrupo', '');

                  const respSave = await fetch(actionUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params.toString(),
                    credentials: 'same-origin'
                  });

                  if (respSave.ok) {
                    addLog('✅ Grupo "' + raw + '" cadastrado no sistema (usuário "' + perfilLogado.rotulo + '" vinculado)!', 'success');
                    const respRecarrega = await fetch(urlListar, { credentials: 'same-origin' });
                    if (respRecarrega.ok) {
                      const htmlRec = await lerRespostaTexto(respRecarrega);
                      const docRec = new DOMParser().parseFromString(htmlRec, 'text/html');
                      docRec.querySelectorAll('tr').forEach(tr => {
                        const tds = tr.querySelectorAll('td');
                        if (tds.length >= 2) {
                          const matchedTd = Array.from(tds).find(td => {
                            const t = normalizar(td.textContent.trim());
                            return t === norm || t.includes(norm);
                          });
                          if (matchedTd) {
                            const m = tr.innerHTML.match(/id_formulario_personalizacao_grupo=(\d+)/i) ||
                                      tr.innerHTML.match(/id_grupo=(\d+)/i) ||
                                      tr.innerHTML.match(/valor=(\d+)/i);
                            if (m) {
                              idExistente = m[1];
                            } else {
                              const chk = tr.querySelector('input[type="checkbox"]');
                              if (chk && chk.value) {
                                idExistente = chk.value;
                              }
                            }
                          }
                        }
                      });
                    }
                  }
                }
              }
            }
          }

          if (idExistente) {
            cacheGruposRelatorio.set(norm, String(idExistente));
            if (selGrupo) {
              let optNova = Array.from(selGrupo.options).find(o => o.value === String(idExistente));
              if (!optNova) {
                optNova = document.createElement('option');
                optNova.value = String(idExistente);
                optNova.text = raw;
                selGrupo.appendChild(optNova);
              }
              selGrupo.value = String(idExistente);
              dispararEventos(selGrupo, ['change']);
            }
            window._eprocGrupoAtualId = String(idExistente);
            addLog('✓ Grupo pronto: "' + raw + '" (ID: ' + idExistente + ')');
            return { id: String(idExistente), text: raw };
          }
        }
      }
    } catch (eG) {
      console.warn('Erro ao gerenciar grupo:', eG);
    }

    return null;
  }




  /* ================== MOTOR DOS 13 PASSOS ================== */

  async function executarPassoAPassoItem(item) {
    if (moduloAtivo === 'relatorios') {
      return await executarPassoAPassoRelatorio(item);
    }
    if (moduloAtivo === 'movimentacoes') {
      return await executarPassoAPassoMovimentacao(item);
    }
    if (moduloAtivo === 'area_minutas') {
      return await executarPassoAPassoAreaMinutas(item);
    }
    if (moduloAtivo === 'intimacoes') {
      return await executarPassoAPassoIntimacao(item);
    }
    return await executarPassoAPassoItemMinuta(item);
  }



  

  /* ================== MÓDULO 2: RELATÓRIO GERAL DE PROCESSOS ================== */

  
  // [v3.5.5] Catálogo Global e Resiliente de Localizadores da Unidade (2G)
  async function obterOuCarregarCatalogoLocalizadoresUnidade() {
    if (Array.isArray(window._eprocCatalogoLocalizadores2G) && window._eprocCatalogoLocalizadores2G.length > 0) {
      return window._eprocCatalogoLocalizadores2G;
    }

    try {
      const cached = sessionStorage.getItem('eproc_catalogo_localizadores_2g');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          window._eprocCatalogoLocalizadores2G = parsed;
          return parsed;
        }
      }
    } catch (e) {}

    // 1. Tenta ler de selects existentes no DOM da página atual
    const selExisting = document.getElementById('selNovoLocalizador') || document.getElementById('selLocalizador');
    if (selExisting && selExisting.options && selExisting.options.length > 2) {
      const list = Array.from(selExisting.options)
        .filter(o => o.value && o.value !== 'null' && o.value !== '')
        .map(o => ({ value: String(o.value).trim(), text: o.text.trim() }));
      if (list.length > 0) {
        window._eprocCatalogoLocalizadores2G = list;
        try { sessionStorage.setItem('eproc_catalogo_localizadores_2g', JSON.stringify(list)); } catch (e) {}
        return list;
      }
    }

    // 2. Tenta via obterLocalizadoresRelatorioGeral()
    try {
      const listRel = await obterLocalizadoresRelatorioGeral();
      if (Array.isArray(listRel) && listRel.length > 0) {
        const parsed = listRel.map(loc => {
          const id = String(loc.IdLocalizadorOrgao || loc.id || loc.value || '').trim();
          const sig = String(loc.SigLocalizador || '').trim();
          const des = String(loc.DesLocalizador || '').trim();
          const label = (sig && des && sig !== des) ? `${sig} - ${des}` : (sig || des);
          return { value: id, text: label };
        }).filter(x => x.value);
        if (parsed.length > 0) {
          window._eprocCatalogoLocalizadores2G = parsed;
          try { sessionStorage.setItem('eproc_catalogo_localizadores_2g', JSON.stringify(parsed)); } catch (e) {}
          return parsed;
        }
      }
    } catch (eRel) {}

    // 3. Tenta buscar minuta_cadastrar ou relatorio_geral_listar via links do menu na página
    try {
      const linksMenu = Array.from(document.querySelectorAll('a[href*="controlador.php?acao="]')).map(a => a.href);
      const linkMinuta = linksMenu.find(h => h.includes('minuta_cadastrar'));
      const linkRel = linksMenu.find(h => h.includes('relatorio_geral_listar'));
      const targetUrl = linkMinuta || linkRel;
      if (targetUrl) {
        const resp = await fetch(targetUrl, { credentials: 'same-origin' });
        if (resp.ok) {
          const buf = await resp.arrayBuffer();
          const html = new TextDecoder('iso-8859-1').decode(buf);
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const docSel = doc.getElementById('selNovoLocalizador') || doc.getElementById('selLocalizador');
          if (docSel && docSel.options && docSel.options.length > 2) {
            const list = Array.from(docSel.options)
              .filter(o => o.value && o.value !== 'null' && o.value !== '')
              .map(o => ({ value: String(o.value).trim(), text: o.text.trim() }));
            if (list.length > 0) {
              window._eprocCatalogoLocalizadores2G = list;
              try { sessionStorage.setItem('eproc_catalogo_localizadores_2g', JSON.stringify(list)); } catch (e) {}
              return list;
            }
          }
        }
      }
    } catch (eNav) {}

    return [];
  }

  async function obterLocalizadoresRelatorioGeral() {
    if (window._eprocCatalogoLocalizadoresRelatorio && window._eprocCatalogoLocalizadoresRelatorio.length > 0) {
      return window._eprocCatalogoLocalizadoresRelatorio;
    }
    try {
      const autoObj = window.$ ? window.$('#selLocalizadorPrincipal').data('UI-multi-autocomplete-object') : null;
      if (autoObj && autoObj.tagifyObject && autoObj.tagifyObject.whitelist && autoObj.tagifyObject.whitelist.length > 0) {
        const wl = autoObj.tagifyObject.whitelist.map(x => x.data || x);
        window._eprocCatalogoLocalizadoresRelatorio = wl;
        return wl;
      }

      let urlLoc = '';
      const scripts = Array.from(document.querySelectorAll('script'));
      for (const s of scripts) {
        const txt = s.textContent || '';
        const m = txt.match(/['"]([^'"]*listar_localizador_orgao[^'"]*)['"]/i);
        if (m) {
          urlLoc = m[1].replace(/\\/g, '').replace(/&amp;/g, '&');
          break;
        }
      }

      if (!urlLoc) {
        const hashAtual = typeof obterHashAtual === 'function' ? obterHashAtual() : '';
        urlLoc = 'controlador.php?acao=relatorio_geral/listar_localizador_orgao&acao_origem=relatorio_geral_listar&hash=' + hashAtual;
      }

      const res = await fetch(urlLoc, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: 'selIdOrgaoJuizo='
      });

      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json) && json.length > 0) {
          window._eprocCatalogoLocalizadoresRelatorio = json;
          return json;
        }
      }
    } catch (e) {
      console.warn('Erro ao consultar localizadores via API de Relatório:', e);
    }
    return [];
  }

  function escapeRegExp(string) {
    return String(string).replace(/[.*+?^$${}()|[\]\\]/g, '\\$&');
  }

  function encontrarLocalizadorNoCatalogo(locNome, locsCatalogo) {
    if (!locNome || !locsCatalogo || locsCatalogo.length === 0) return null;
    const nNorm = normalizar(locNome);
    const nRaw = String(locNome).trim().toLowerCase();

    // 1. Match exato na sigla ou descrição normalizada
    let achou = locsCatalogo.find(c => {
      const sig = normalizar(c.SigLocalizador || '');
      const des = normalizar(c.DesLocalizador || '');
      return (sig && sig === nNorm) || (des && des === nNorm);
    });
    if (achou) return achou;

    // 2. Match exato na string bruta (preserva números e emojis)
    achou = locsCatalogo.find(c => {
      const sigRaw = String(c.SigLocalizador || '').trim().toLowerCase();
      const desRaw = String(c.DesLocalizador || '').trim().toLowerCase();
      return (sigRaw && sigRaw === nRaw) || (desRaw && desRaw === nRaw);
    });
    if (achou) return achou;

    // 3. Match composto: Sigla + Descrição normalizada
    achou = locsCatalogo.find(c => {
      const sigDes = normalizar((c.SigLocalizador || '') + ' ' + (c.DesLocalizador || ''));
      return sigDes === nNorm;
    });
    if (achou) return achou;

    // 4. Match de palavra/token exato
    achou = locsCatalogo.find(c => {
      const sig = normalizar(c.SigLocalizador || '');
      if (!sig) return false;
      const re = new RegExp('(^|\\s)' + escapeRegExp(nNorm) + '(\\s|$)', 'i');
      return re.test(sig);
    });
    if (achou) return achou;

    // 5. Substring onde a sigla do catálogo contém o termo pesquisado (com verificação estrita de números)
    const digitosBusca = (nNorm.match(/\d+/) || [])[0];
    achou = locsCatalogo.find(c => {
      const sig = normalizar(c.SigLocalizador || '');
      const des = normalizar(c.DesLocalizador || '');
      const digitosSig = (sig.match(/\d+/) || [])[0];
      if (digitosBusca && digitosSig && digitosBusca !== digitosSig) {
        return false;
      }
      return (sig && sig.includes(nNorm)) || (des && des.includes(nNorm));
    });
    if (achou) return achou;

    // 6. Substring inversa (termo pesquisado contém a sigla do catálogo)
    achou = locsCatalogo.find(c => {
      const sig = normalizar(c.SigLocalizador || '');
      if (!sig || sig.length < 3) return false;
      const digitosSig = (sig.match(/\d+/) || [])[0];
      if (digitosBusca && digitosSig && digitosBusca !== digitosSig) {
        return false;
      }
      return nNorm.includes(sig);
    });
    return achou || null;
  }

  function decodificarEntidadesHtml(str) {
    if (!str) return '';
    let s = String(str)
      .replace(/&#(\d+);/g, (_, dec) => {
        try { return String.fromCodePoint(parseInt(dec, 10)); } catch (e) { return _; }
      })
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
        try { return String.fromCodePoint(parseInt(hex, 16)); } catch (e) { return _; }
      });
    if (s.includes('&')) {
      const txt = document.createElement('textarea');
      txt.innerHTML = s;
      s = txt.value;
    }
    return s.trim();
  }

  async function obterPreferenciaRelatorioExistentes() {
    const existentes = new Set();
    const mapaIds = new Map();

    const registrarPref = (descBruta, id) => {
      if (!descBruta) return;
      const descLimpa = decodificarEntidadesHtml(descBruta).trim();
      if (!descLimpa || descLimpa.length < 2) return;
      existentes.add(descLimpa);
      const norm = normalizar(descLimpa);
      if (norm) existentes.add(norm);
      if (id) {
        mapaIds.set(norm, String(id));
        mapaIds.set(descLimpa, String(id));
      }
    };

    // 0. Se o modal na página ou Tagify já contém dados carregados
    try {
      const modalEl = document.getElementById('selPreferencia-modal');
      if (modalEl) {
        modalEl.querySelectorAll('tr, li, .list-group-item, a, td, span').forEach(el => {
          const txt = (el.textContent || '').trim();
          const id = el.getAttribute('data-id') || (el.querySelector('[data-id]') ? el.querySelector('[data-id]').getAttribute('data-id') : null);
          if (txt && txt.length > 2 && !/^(selecione|fechar|salvar|cancelar|aes|ao|descrio)$/i.test(normalizar(txt))) {
            registrarPref(txt, id);
          }
        });
      }

      const inpPref = document.getElementById('selPreferencia');
      if (inpPref) {
        const tagify = inpPref.__tagify || (window.$ ? window.$(inpPref).data('tagify') : null);
        if (tagify && tagify.whitelist && Array.isArray(tagify.whitelist) && tagify.whitelist.length > 0) {
          tagify.whitelist.forEach(it => {
            const desc = it.value || it.label || it.Descricao || (typeof it === 'string' ? it : '');
            const id = it.key || it.IdFormularioPersonalizacao || it.id || '';
            registrarPref(desc, id);
          });
        }
      }
    } catch (eTag) {}

    // 1. Consulta o modal oficial de listagem completa de preferências da Unidade (ui_preferencias/modal_lista_preferencias)
    try {
      let urlModal = '';
      const btnLista = document.getElementById('selPreferencia-list') || document.querySelector('[data-url*="modal_lista_preferencias"]');
      if (btnLista && btnLista.getAttribute('data-url')) {
        urlModal = btnLista.getAttribute('data-url');
      }

      if (!urlModal) {
        const mModal = document.documentElement.innerHTML.match(/['"]([^'"]*ui_preferencias[\\\/]+modal_lista_preferencias[^'"]*)['"]/i);
        if (mModal) {
          urlModal = mModal[1];
        }
      }

      if (!urlModal) {
        const hashAtual = typeof obterHashAtual === 'function' ? obterHashAtual() : '';
        if (hashAtual) {
          urlModal = 'controlador.php?acao=ui_preferencias/modal_lista_preferencias&acao_request=relatorio_geral_listar&acao_origem=relatorio_geral_listar&hash=' + hashAtual;
        }
      }

      if (urlModal) {
        const cleanUrl = urlModal.replace(/\\/g, '').replace(/&amp;/g, '&');
        const promModal = (async () => {
          let html = '';
          try {
            // Tenta POST com form_request_id oficial
            const resModal = await fetch(cleanUrl, {
              method: 'POST',
              credentials: 'same-origin',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest'
              },
              body: 'form_request_id=frmProcessoLista'
            });
            if (resModal.ok) {
              html = await resModal.text();
            }
          } catch (ePost) {}

          // Se falhou ou vazio, tenta GET
          if (!html || html.length < 50) {
            try {
              const getUrl = cleanUrl + (cleanUrl.includes('?') ? '&' : '?') + 'form_request_id=frmProcessoLista';
              const resGet = await fetch(getUrl, {
                method: 'GET',
                credentials: 'same-origin',
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
              });
              if (resGet.ok) {
                html = await resGet.text();
              }
            } catch (eGet) {}
          }

          // Se ainda vazio, tenta via jQuery e sessão ativa da página
          if (!html || html.length < 50) {
            try {
              if (window.$ && typeof window.$.ajax === 'function') {
                html = await new Promise((resolve) => {
                  window.$.ajax({
                    url: cleanUrl,
                    method: 'POST',
                    data: { form_request_id: 'frmProcessoLista' },
                    success: function (data) { resolve(data || ''); },
                    error: function () { resolve(''); }
                  });
                });
              }
            } catch (eJqModal) {}
          }

          if (html && html.length > 50) {
            const doc = new DOMParser().parseFromString(html, 'text/html');

            // 1.1 Mapeia todas as linhas e células
            doc.querySelectorAll('tr').forEach(tr => {
              const idAttr = tr.getAttribute('data-id') || (tr.querySelector('[data-id]') ? tr.querySelector('[data-id]').getAttribute('data-id') : null);
              const cells = tr.cells;
              if (cells && cells.length >= 1) {
                Array.from(cells).forEach(cell => {
                  const txt = decodificarEntidadesHtml(cell.textContent.trim());
                  if (txt && txt.length > 2 && !/^(descrio|nome|aes|ao|grupo|padro|painel)$/i.test(normalizar(txt))) {
                    registrarPref(txt, idAttr);
                  }
                });
              }
            });

            // 1.2 Mapeia outros elementos que possam carregar descrições
            doc.querySelectorAll('a, li, .list-group-item, span').forEach(el => {
              const txt = decodificarEntidadesHtml((el.textContent || '').trim());
              const id = el.getAttribute('data-id') || '';
              if (txt && txt.length > 2 && !/^(descrio|nome|aes|ao|grupo|padro|painel|fechar|salvar)$/i.test(normalizar(txt))) {
                if (txt.includes('?') || txt.includes('?') || txt.includes('?') || txt.includes('?') || txt.includes('?') || txt.includes('Servidor') || txt.includes('Petio') || txt.includes('Apelao') || txt.includes('Minutar') || txt.includes('Movimentao')) {
                  registrarPref(txt, id);
                }
              }
            });

            // 1.3 Comparação direta do texto bruto com os itens carregados da planilha
            if (itensCarregados && itensCarregados.length > 0) {
              const htmlNorm = normalizar(html);
              const docTextNorm = normalizar(doc.body.textContent || '');
              itensCarregados.forEach(it => {
                if (it.nome) {
                  const nNorm = normalizar(it.nome);
                  const nSemEmoji = normalizar(removerEmojis(it.nome));
                  if (htmlNorm.includes(nNorm) || docTextNorm.includes(nNorm) || (nSemEmoji.length > 4 && (htmlNorm.includes(nSemEmoji) || docTextNorm.includes(nSemEmoji)))) {
                    registrarPref(it.nome);
                  }
                }
              });
            }
          }
        })();
        await Promise.race([promModal, sleep(5000)]);
      }
    } catch (eModal) {
      console.warn('Erro ao consultar modal de preferências de relatório:', eModal);
    }

    // 2. Consulta o endpoint JSON oficial de listar preferências (ui_preferencias/listar)
    try {
      let urlList = '';
      const scripts = Array.from(document.querySelectorAll('script'));
      for (const s of scripts) {
        const txt = s.textContent || '';
        const m = txt.match(/['"]([^'"]*ui_preferencias[\\\/]+listar[^'"]*)['"]/i);
        if (m) {
          urlList = m[1].replace(/\\/g, '').replace(/&amp;/g, '&');
          break;
        }
      }

      if (!urlList) {
        const mDoc = document.documentElement.innerHTML.match(/['"]([^'"]*ui_preferencias[\\\/]+listar[^'"]*)['"]/i);
        if (mDoc) {
          urlList = mDoc[1].replace(/\\/g, '').replace(/&amp;/g, '&');
        }
      }

      if (!urlList) {
        const hashAtual = typeof obterHashAtual === 'function' ? obterHashAtual() : '';
        if (hashAtual) {
          urlList = 'controlador.php?acao=ui_preferencias/listar&acao_request=relatorio_geral_listar&acao_origem=relatorio_geral_listar&hash=' + hashAtual;
        }
      }

      if (urlList) {
        urlList = urlList.replace(/&amp;/g, '&');
        const promJson = (async () => {
          // Testa múltiplos formatos de query que o backend aceita
          const queries = ['q=', 'value=', 'q=%', 'term='];
          for (const qBody of queries) {
            try {
              const resList = await fetch(urlList, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                  'X-Requested-With': 'XMLHttpRequest'
                },
                body: qBody
              });

              if (resList.ok) {
                const jsonList = await resList.json();
                const lista = Array.isArray(jsonList) ? jsonList : (jsonList.data || jsonList.itens || jsonList.items || []);
                if (Array.isArray(lista) && lista.length > 0) {
                  lista.forEach(p => {
                    const id = p.IdFormularioPersonalizacao || p.IdPreferencia || p.id || p.value;
                    const desc = p.Descricao || p.nome || p.label || '';
                    registrarPref(desc, id);
                  });
                  break;
                }
              }
            } catch (eQ) {}
          }
        })();
        await Promise.race([promJson, sleep(4000)]);
      }
    } catch (eList) {
      console.warn('Erro ao consultar endpoint JSON de preferências:', eList);
    }

    window._eprocMapaPreferenciasRelatorio = mapaIds;
    return existentes;
  }

  async function executarDiagnosticoPreVooRelatorios() {
    if (!itensCarregados || itensCarregados.length === 0) {
      alertOriginal.call(window, 'Carregue primeiro a planilha unificada antes de executar a Verificação prévia.');
      return;
    }

    const btnDiag = document.getElementById('btn-rito-diagnostico');
    const btnIni = document.getElementById('btn-rito-iniciar');
    if (btnDiag) {
      btnDiag.disabled = true;
      btnDiag.classList.add('rito-diagnostico-ativo');
      btnDiag.innerHTML = '<span>⏳</span> Verificando (0%)...';
    }
    if (btnIni) btnIni.disabled = true;

    try {
      addLog('🔍 Iniciando Verificação prévia: Módulo Relatório Geral...');
      atualizarProgressoDiagnostico(15, 'Etapa 1/3', '1. Mapeando Localizadores de Relatório...', true);
      await sleep(80);

      const listaLocs = await obterLocalizadoresRelatorioGeral();
      addLog('✓ ' + listaLocs.length + ' localizador(es) encontrados no catálogo de Relatórios da Unidade.');

      atualizarProgressoDiagnostico(50, 'Etapa 2/3', '2. Verificando Grupos de Preferências...', true);
      await sleep(80);

      const gruposPlanilha = Array.from(new Set(itensCarregados.map(it => it.grupo).filter(g => g && g !== '-')));
      addLog('📁 Identificando grupos de preferências da planilha (' + gruposPlanilha.length + ' grupo(s))...');
      const gruposCadastrados = await obterGruposCadastradosNoEproc2G();
      const gruposFaltantes = gruposPlanilha.filter(g => !gruposCadastrados.has(normalizar(g)));
      addLog('✓ Grupos da planilha: ' + gruposPlanilha.length + ' mapeados (' + gruposFaltantes.length + ' novos a serem criados no eproc).');

      atualizarProgressoDiagnostico(85, 'Etapa 3/3', '3. Verificando Preferências Existentes...', true);
      await sleep(80);

      addLog('📋 Consultando preferências já salvas na Unidade...');
      const existentes = await obterPreferenciaRelatorioExistentes();
      const totalItens = itensCarregados.length;
      let jaExistemCount = 0;
      itensCarregados.forEach(it => {
        if (preferenciaJaExiste(it.nome, existentes)) jaExistemCount++;
      });
      const totalUnicas = new Set(Array.from(existentes).map(normalizar)).size;
      addLog('✓ ' + totalUnicas + ' preferência(s) existentes localizadas na Unidade.');

      atualizarProgressoDiagnostico(100, 'Concluído', 'Verificação prévia concluída!', false);

      addLog('=== RELATÓRIO DA VERIFICAÇÃO PRÉVIA (RELATÓRIOS) ===');
      addLog('• Total de preferências na planilha: ' + totalItens);
      addLog('• Grupos mapeados: ' + gruposPlanilha.length + ' (' + gruposFaltantes.length + ' serão criados automaticamente)');
      addLog('• Preferências já existentes na Unidade: ' + jaExistemCount + (jaExistemCount > 0 ? ' (serão puladas automaticamente)' : ''));
      addLog('✅ Auditoria de integridade concluída com sucesso!', 'success');
    } catch (err) {
      console.error('Erro na verificação de relatórios:', err);
      addLog('❌ Erro na verificação prévia de Relatórios: ' + (err.message || err), 'error');
      atualizarProgressoDiagnostico(100, 'Falha', 'Erro na verificação: ' + (err.message || err), false);
    } finally {
      if (btnDiag) {
        btnDiag.disabled = false;
        btnDiag.classList.remove('rito-diagnostico-ativo');
        btnDiag.innerHTML = '<span>🔍</span> Reabrir Relatório da Verificação';
      }
      if (btnIni) btnIni.disabled = false;
    }
  }

  async function garantirGruposRelatoriosEmLote(itens) {
    const gruposUnicos = Array.from(new Set(itens.map(it => it.grupo).filter(g => g && g !== '-')));
    if (gruposUnicos.length === 0) return;

    addLog('📁 Verificando/Cadastrando ' + gruposUnicos.length + ' grupo(s) de preferências no eproc 2G...');
    const mapaIds = new Map();

    for (const g of gruposUnicos) {
      try {
        const res = await gerenciarGrupoPreferencia2G(g);
        if (res && res.id) {
          mapaIds.set(normalizar(g), res.id);
          addLog('✓ Grupo pronto: "' + g + '" (ID: ' + res.id + ')');
        }
      } catch (e) {
        console.warn('Erro ao garantir grupo ' + g + ':', e);
      }
      await sleep(150);
    }
    return mapaIds;
  }

  async function aplicarFiltrosRelatorio(item) {
    const frmProc = document.getElementById('frmProcessoLista');
    if (!frmProc) throw new Error('Formulário #frmProcessoLista não encontrado.');

    // A. Container de injeção direta de hidden inputs para garantia absoluta de serialização
    let container = document.getElementById('eproc_ext_filtros_container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'eproc_ext_filtros_container';
      container.style.display = 'none';
      frmProc.appendChild(container);
    }
    container.innerHTML = '';

    // B. Limpeza preventiva de inputs residuais de localizadores anteriores
    frmProc.querySelectorAll('input[name^="selLocalizadorPrincipal_value"]').forEach(el => {
      if (el.parentNode && el.parentNode !== container) {
        el.parentNode.removeChild(el);
      }
    });

    const inpLoc = document.getElementById('selLocalizadorPrincipal');
    const autoObj = window.$ ? window.$('#selLocalizadorPrincipal').data('UI-multi-autocomplete-object') : null;
    if (autoObj && typeof autoObj.clear === 'function') {
      try { autoObj.clear(); } catch (e) {}
    }
    if (inpLoc) inpLoc.value = '';

    // C. Mapeamento e Inserção dos Localizadores
    const itensAchados = [];
    if (item.localizadores && item.localizadores.length > 0) {
      const locsCatalogo = await obterLocalizadoresRelatorioGeral();
      for (const locNome of item.localizadores) {
        const achou = encontrarLocalizadorNoCatalogo(locNome, locsCatalogo);
        if (achou) {
          itensAchados.push(achou);
        } else {
          addLog('⚠️ Localizador não localizado no catálogo: "' + locNome + '"', 'warn');
        }
      }

      // Preenche o componente Tagify oficial do eproc primeiro
      if (autoObj && typeof autoObj.add === 'function' && itensAchados.length > 0) {
        try {
          autoObj.add(itensAchados);
        } catch (e) {
          console.warn('Erro ao chamar autoObj.add:', e);
        }
      }

      // Garante que os campos hidden esperados pelo backend PHP do eproc existam no form (sem duplicar se o Tagify já criou)
      for (const achou of itensAchados) {
        const id = String(achou.IdLocalizadorOrgao || achou.id || achou.value);
        const sig = String(achou.SigLocalizador || '');
        const des = String(achou.DesLocalizador || '');

        if (!frmProc.querySelector('input[name="selLocalizadorPrincipal_value[' + id + '][IdLocalizadorOrgao]"]')) {
          const hId = document.createElement('input');
          hId.type = 'hidden';
          hId.name = 'selLocalizadorPrincipal_value[' + id + '][IdLocalizadorOrgao]';
          hId.value = id;
          container.appendChild(hId);

          const hSig = document.createElement('input');
          hSig.type = 'hidden';
          hSig.name = 'selLocalizadorPrincipal_value[' + id + '][SigLocalizador]';
          hSig.value = sig;
          container.appendChild(hSig);

          const hDes = document.createElement('input');
          hDes.type = 'hidden';
          hDes.name = 'selLocalizadorPrincipal_value[' + id + '][DesLocalizador]';
          hDes.value = des;
          container.appendChild(hDes);
        }
      }

      // Preenche o valor do input com JSON formatado para Tagify caso não preenchido
      if (inpLoc && (!inpLoc.value || inpLoc.value === '[]') && itensAchados.length > 0) {
        const tagifyData = itensAchados.map((achou, idx) => ({
          key: idx,
          isObject: false,
          value: (achou.SigLocalizador || '') + ' - ' + (achou.DesLocalizador || ''),
          data: achou
        }));
        inpLoc.value = JSON.stringify(tagifyData);
      }

      if (inpLoc) {
        destacarCampoAtivo(inpLoc, 'Localizadores Filtro', item.localizadores.join('; '));
      }
    }

    // D. Operador do Localizador conforme coluna "Operação (E/OU)" da planilha
    const opDesejada = (item.operacao && String(item.operacao).trim().toUpperCase() === 'OU') ? 'OU' : 'E';
    const rdOpE = document.querySelector('input[name="tipoOperacaoLocalizador"][value="E"]') || document.getElementById('operacaoELocalizador');
    const rdOpOU = document.querySelector('input[name="tipoOperacaoLocalizador"][value="OU"]') || document.getElementById('operacaoOuLocalizador');
    if (rdOpE) rdOpE.disabled = false;
    if (rdOpOU) rdOpOU.disabled = false;

    if (opDesejada === 'E') {
      if (rdOpOU) {
        rdOpOU.checked = false;
        rdOpOU.removeAttribute('checked');
      }
      if (rdOpE) {
        rdOpE.checked = true;
        rdOpE.setAttribute('checked', 'checked');
        dispararEventos(rdOpE, ['click', 'change']);
      }
    } else {
      if (rdOpE) {
        rdOpE.checked = false;
        rdOpE.removeAttribute('checked');
      }
      if (rdOpOU) {
        rdOpOU.checked = true;
        rdOpOU.setAttribute('checked', 'checked');
        dispararEventos(rdOpOU, ['click', 'change']);
      }
    }

    // Se os radios não existirem no DOM por qualquer motivo, injeta hidden no container
    if (!rdOpE && !rdOpOU) {
      const hOp = document.createElement('input');
      hOp.type = 'hidden';
      hOp.name = 'tipoOperacaoLocalizador';
      hOp.value = opDesejada;
      container.appendChild(hOp);
    }

    // E. Situação Processual (#selStatusProcesso)
    const selStatus = document.getElementById('selStatusProcesso');
    if (selStatus) {
      let valoresStatus = [];
      const sitNorm = normalizar(item.situacao);
      if (sitNorm.includes('moviment')) valoresStatus = ['M'];
      else if (sitNorm.includes('suspens')) valoresStatus = ['S'];
      else if (sitNorm.includes('baixad')) valoresStatus = ['B'];
      else valoresStatus = [];

      if (window.$) {
        window.$('#selStatusProcesso').val(valoresStatus);
        try { window.$('#selStatusProcesso').selectpicker('refresh'); } catch (e) {}
      } else {
        Array.from(selStatus.options).forEach(opt => {
          opt.selected = valoresStatus.includes(opt.value);
        });
      }
      dispararEventos(selStatus, ['change']);
      if (valoresStatus.length > 0) {
        destacarCampoAtivo(selStatus, 'Situação Processual', valoresStatus.join(', '));
      }
    }

    // F. Conteúdo do Lembrete (#txtLembrete) - garante que "TODOS" ou "-" nunca sejam inseridos
    const inpLembrete = document.getElementById('txtLembrete');
    let valLembrete = '';
    if (item.lembrete) {
      const rawL = String(item.lembrete).trim();
      const normL = normalizar(rawL);
      if (rawL && rawL !== '-' && normL !== 'todos' && normL !== 'movimento' && normL !== 'suspenso' && normL !== 'baixado') {
        valLembrete = rawL.replace(/^lembrete:\s*/i, '').trim();
      }
    }
    if (inpLembrete) {
      inpLembrete.value = valLembrete;
      dispararEventos(inpLembrete, ['input', 'change']);
      if (valLembrete) {
        destacarCampoAtivo(inpLembrete, 'Conteúdo do Lembrete', valLembrete);
      }
    }
  }

  async function executarPassoAPassoRelatorio(item) {
    if (window._eprocPararLote) throw new Error('PARADA_SOLICITADA');
    gravacaoEmAndamento = true;

    const opDesejada = (item.operacao && String(item.operacao).trim().toUpperCase() === 'OU') ? 'OU' : 'E';
    let valLembreteFinal = '';
    if (item.lembrete) {
      const rawL = String(item.lembrete).trim();
      const normL = normalizar(rawL);
      if (rawL && rawL !== '-' && normL !== 'todos' && normL !== 'movimento' && normL !== 'suspenso' && normL !== 'baixado') {
        valLembreteFinal = rawL.replace(/^lembrete:\s*/i, '').trim();
      }
    }

    addLog('Configurando preferência de Relatório: "' + item.nome + '" (Operação: ' + opDesejada + ')...');

    // 1. Garante grupo da preferência na unidade
    let idGrupo = '';
    if (item.grupo && item.grupo !== '-') {
      const resGrupo = await gerenciarGrupoPreferencia2G(item.grupo);
      if (resGrupo && resGrupo.id) {
        idGrupo = String(resGrupo.id);
      }
    }

    // 2. Identifica se a preferência já existe no eproc: se existir, pula como DUPLICADA
    let idExistente = null;
    if (window._eprocMapaPreferenciasRelatorio) {
      idExistente = window._eprocMapaPreferenciasRelatorio.get(normalizar(item.nome)) ||
                    window._eprocMapaPreferenciasRelatorio.get(item.nome.trim()) || null;
    }
    if (idExistente) {
      throw new Error('DUPLICADA: Essa preferência já existe na unidade');
    }

    // 3. Aplica todos os filtros de pesquisa na tela (#frmProcessoLista)
    await aplicarFiltrosRelatorio(item);
    await sleep(100);

    // 4. Obtém o formulário do modal via fetch direto
    const btnAdd = document.getElementById('selPreferencia-add');
    if (!btnAdd) throw new Error('Botão selPreferencia-add não encontrado na tela de Relatório Geral.');

    const urlModalRaw = btnAdd.getAttribute('data-url') || '';
    const urlModalClean = urlModalRaw.replace(/&amp;/g, '&');
    if (!urlModalClean) throw new Error('data-url do selPreferencia-add não encontrado.');

    const respModal = await fetch(urlModalClean, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: 'form_request_id=frmProcessoLista'
    });

    if (!respModal.ok) throw new Error('Falha ao abrir modal de preferência do eproc (HTTP ' + respModal.status + ')');
    const htmlModal = await respModal.text();

    // 5. Extrai as URLs com tokens/hashes atualizados gerados pelo eproc
    const mAdd = htmlModal.match(/['"](controlador\.php\?acao=ui_preferencias\/adicionar_preferencia[^'"]*)['"]/i) ||
                 htmlModal.match(/url:\s*['"]([^'"]*adicionar_preferencia[^'"]*)['"]/i);
    const mReq = htmlModal.match(/['"](controlador\.php\?acao=ui_preferencias\/salvar_request&[^'"]*modal_add_preferencia[^'"]*)['"]/i) ||
                 htmlModal.match(/['"](controlador\.php\?acao=ui_preferencias\/salvar_request[^'"]*)['"]/i);

    if (!mAdd || !mReq) {
      throw new Error('Não foi possível extrair as URLs de gravação do modal de preferência do eproc.');
    }

    const urlAdicionar = mAdd[1].replace(/&amp;/g, '&');
    const urlSalvarReq = mReq[1].replace(/&amp;/g, '&');

    // 6. Configura e serializa os campos do formulário retornado pelo eproc
    const docModal = new DOMParser().parseFromString(htmlModal, 'text/html');
    const formModal = docModal.getElementById('frm_alterar_preferencia');
    if (!formModal) throw new Error('Formulário frm_alterar_preferencia não encontrado no modal do eproc.');

    // Descrição convertida para entidades decimais (compatível com emojis)
    const inpDesc = formModal.querySelector('#Descricao');
    if (inpDesc) inpDesc.value = toHtmlEntityDecimal(item.nome);

    // Tipo de preferência: Unidade ('U')
    const rdUnidade = formModal.querySelector('#rdUnidade');
    if (rdUnidade) { rdUnidade.checked = true; rdUnidade.setAttribute('checked', 'checked'); }
    const rdIndiv = formModal.querySelector('#rdIndividual');
    if (rdIndiv) { rdIndiv.checked = false; rdIndiv.removeAttribute('checked'); }

    // Marcar como padrão
    const chkPadrao = formModal.querySelector('#SinValorPadrao');
    if (chkPadrao) {
      if (item.padrao) { chkPadrao.checked = true; chkPadrao.setAttribute('checked', 'checked'); }
      else { chkPadrao.checked = false; chkPadrao.removeAttribute('checked'); }
    }

    // Painel inicial
    const chkPainel = formModal.querySelector('#SinPainelInicial');
    if (chkPainel) {
      if (item.painelInicial) { chkPainel.checked = true; chkPainel.setAttribute('checked', 'checked'); }
      else { chkPainel.checked = false; chkPainel.removeAttribute('checked'); }
    }

    // Se já existir no eproc, passa o ID para alteração em vez de duplicar
    if (idExistente) {
      const inpIdForm = formModal.querySelector('#IdFormularioPersonalizacao');
      if (inpIdForm) inpIdForm.value = idExistente;
    }

    // Grupo: obtém da lista de opções reais do <select id="Grupo"> gerado pelo eproc
    const selGrupoModal = formModal.querySelector('#Grupo');
    let idGrupoModal = '';
    if (selGrupoModal && item.grupo && item.grupo !== '-') {
      const normG = normalizar(item.grupo);
      const opt = Array.from(selGrupoModal.options).find(o => o.value && (normalizar(o.text) === normG || normalizar(o.text).includes(normG) || (idGrupo && o.value === idGrupo)));
      if (opt) {
        idGrupoModal = opt.value;
        selGrupoModal.value = opt.value;
        cacheGruposRelatorio.set(normG, opt.value);
      }
    }
    if (selGrupoModal && !idGrupoModal) {
      selGrupoModal.value = '';
    }

    // Monta os parâmetros exatamente como o form do eproc envia
    const paramsAdd = new URLSearchParams();
    formModal.querySelectorAll('input, select, textarea').forEach(el => {
      if (!el.name || el.disabled) return;
      if (el.type === 'checkbox') {
        if (el.checked) paramsAdd.append(el.name, el.value || 'on');
      } else if (el.type === 'radio') {
        if (el.checked) paramsAdd.append(el.name, el.value);
      } else {
        paramsAdd.append(el.name, el.value);
      }
    });
    if (idGrupoModal) {
      paramsAdd.set('Grupo', idGrupoModal);
    }
    if (idExistente) {
      paramsAdd.set('IdFormularioPersonalizacao', idExistente);
    }

    let idPreferencia = idExistente || null;
    try {
      addLog('📤 Salvando cabeçalho da preferência: "' + item.nome + '"' + (idExistente ? ' (Atualizando ID: ' + idExistente + ')' : '') + '...');
      const respAdd = await fetch(urlAdicionar, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: paramsAdd.toString()
      });

      if (respAdd.ok) {
        const textAdd = (await respAdd.text()).trim();
        try {
          const jsonAdd = JSON.parse(textAdd);
          if (typeof jsonAdd === 'object' && jsonAdd !== null) {
            idPreferencia = jsonAdd.id || jsonAdd.IdPreferencia || jsonAdd.IdFormularioPersonalizacao || jsonAdd.retorno || jsonAdd.data || idPreferencia;
          } else {
            idPreferencia = String(jsonAdd) || idPreferencia;
          }
        } catch (e) {
          if (textAdd && textAdd.length < 50 && !textAdd.includes('<')) {
            idPreferencia = textAdd;
          }
        }
      } else if (!idPreferencia) {
        let errTxt = '';
        try { errTxt = await respAdd.text(); } catch (e) {}
        let errDecodificado = errTxt;
        if (errTxt) {
          try {
            const jErr = JSON.parse(errTxt);
            if (jErr && typeof jErr === 'object') {
              if (jErr.geral && jErr.geral.geral0) {
                errDecodificado = String(jErr.geral.geral0);
              } else {
                errDecodificado = JSON.stringify(jErr);
              }
            }
          } catch (eJson) {
            errDecodificado = errTxt.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
          }
        }
        const errNorm = normalizar(errDecodificado);
        if (
          errNorm.includes('ja existe') ||
          errNorm.includes('mesma descricao') ||
          errTxt.includes('u00e1 existe') ||
          errTxt.includes('mesma descri')
        ) {
          throw new Error('DUPLICADA: Essa preferência já existe na unidade');
        }
        let msgErro = '';
        if (errDecodificado) {
          const mErro = errDecodificado.match(/<div class="alert alert-danger[^>]*>([\s\S]*?)<\/div>/i) ||
                        errDecodificado.match(/class="infraExcecao"[^>]*>([\s\S]*?)<\/div>/i) ||
                        errDecodificado.match(/["']mensagem["']:\s*["']([^"']+)["']/i);
          if (mErro) msgErro = mErro[1].replace(/<[^>]+>/g, '').trim();
          else msgErro = errDecodificado.substring(0, 150).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        }
        throw new Error('Falha ao adicionar preferência (HTTP ' + respAdd.status + (msgErro ? ': ' + msgErro : '') + ')');
      }
    } catch (eAdd) {
      if (!idPreferencia) throw eAdd;
      addLog('ℹ️ Cabeçalho já existente no eproc, prosseguindo com vinculação de filtros para ID: ' + idPreferencia);
    }

    if (idPreferencia) {
      idPreferencia = String(idPreferencia).replace(/["']/g, '').trim();
    }
    if (!idPreferencia || idPreferencia === 'null' || idPreferencia === '0' || idPreferencia === 'false') {
      throw new Error('Retorno inválido ao criar/atualizar preferência.');
    }

    // 7. Vincula os filtros da pesquisa da tela à preferência criada/atualizada (salvar_request)
    addLog('💾 Vinculando filtros do relatório (ID: ' + idPreferencia + ', Operação: ' + opDesejada + ')...');
    let bodyReq = '';
    if (window.$ && window.$('#frmProcessoLista').length) {
      if (window.$('#frmIdPreferencia #IdPreferencia').length) {
        window.$('#frmIdPreferencia #IdPreferencia').val(idPreferencia);
      }
      const formSerial = window.$('#frmProcessoLista').serialize();
      bodyReq = 'IdPreferencia=' + encodeURIComponent(idPreferencia) + (formSerial ? '&' + formSerial : '');
    } else {
      const frmProc = document.getElementById('frmProcessoLista');
      const fd = frmProc ? new FormData(frmProc) : new FormData();
      fd.set('IdPreferencia', idPreferencia);
      const sp = new URLSearchParams();
      for (const [k, v] of fd.entries()) {
        sp.append(k, v);
      }
      bodyReq = sp.toString();
    }

    // Garante no payload serializado o valor exato de tipoOperacaoLocalizador (E/OU) e txtLembrete
    const spFinal = new URLSearchParams(bodyReq);
    spFinal.set('tipoOperacaoLocalizador', opDesejada);
    spFinal.set('txtLembrete', valLembreteFinal);
    bodyReq = spFinal.toString();

    const respReq = await fetch(urlSalvarReq, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: bodyReq
    });

    if (!respReq.ok) {
      let errTxt = '';
      try { errTxt = await respReq.text(); } catch (e) {}
      throw new Error('Falha ao vincular filtros da preferência (HTTP ' + respReq.status + (errTxt ? ': ' + errTxt.substring(0, 150) : '') + ')');
    }

    if (window._eprocMapaPreferenciasRelatorio) {
      window._eprocMapaPreferenciasRelatorio.set(normalizar(item.nome), String(idPreferencia));
      window._eprocMapaPreferenciasRelatorio.set(item.nome.trim(), String(idPreferencia));
    }

    addLog('✅ Preferência de Relatório gravada com filtros: "' + item.nome + '"', 'success');
    gravacaoEmAndamento = false;
    await sleep(150);

    return {
      linha: item.linha,
      nome: item.nome,
      tipoPref: 'Unidade',
      grupo: item.grupo || '(Nenhum)',
      comoSalvar: idExistente ? 'Filtros Atualizados no Relatório Geral' : 'Filtros Criados no Relatório Geral',
      acaoPref: item.painelInicial ? 'Sim (Painel Inicial)' : 'Não',
      operacao: opDesejada,
      localizadores: item.localizadores.join(', ') || '(Nenhum)',
      situacao: item.situacao || 'TODOS',
      lembrete: valLembreteFinal || '-'
    };
  }

  /* ================== MÓDULO 3: MOVIMENTAÇÃO PROCESSUAL ================== */

  const STOPWORDS_EVENTO_MOV = new Set([
    'para', 'de', 'do', 'da', 'dos', 'das', 'os', 'as', 'ao', 'aos',
    'em', 'no', 'na', 'nos', 'nas', 'a', 'o', 'e', 'por', 'com'
  ]);

  function limparDescEventoMov(str) {
    if (!str) return '';
    return normalizar(
      decodificarEntidadesHtml(String(str))
        .replace(/\(\s*\d+\s*\)/g, ' ')
        .replace(/[-–—/\\]+/g, ' ')
    );
  }

  function tokensSignificativosEventoMov(str) {
    const limpo = limparDescEventoMov(str);
    if (!limpo) return [];
    return limpo.split(/\s+/).filter(w => w && !STOPWORDS_EVENTO_MOV.has(w));
  }

  function obterUrlAjaxEventoMovimentacao() {
    const urlObj = (window.objAjaxAutoCompEvento && (window.objAjaxAutoCompEvento.ajaxTarget || window.objAjaxAutoCompEvento.urlServico)) || window.mc_strLinkAjaxEvento;
    if (urlObj) return String(urlObj).replace(/&amp;/g, '&');

    for (const s of document.scripts) {
      const txt = s.textContent || '';
      if (txt.includes('evento_judicial_auto_completar')) {
        const m = txt.match(/['"](controlador_ajax\.php\?[^'"]*acao_ajax=evento_judicial_auto_completar[^'"]*)['"]/i);
        if (m) return m[1].replace(/\\/g, '').replace(/&amp;/g, '&');
      }
    }
    return '';
  }

  async function obterCatalogoEventosMovimentacao(termoOpcional = '') {
    if (!window._eprocPoolEventosMovimentacao) {
      window._eprocPoolEventosMovimentacao = new Map();
    }
    const mapa = window._eprocPoolEventosMovimentacao;
    const url = obterUrlAjaxEventoMovimentacao();

    const extrairItensDeXml = (txt) => {
      if (!txt) return;
      try {
        const parser = new DOMParser();
        const xml = parser.parseFromString(txt, 'text/xml');
        xml.querySelectorAll('item').forEach(it => {
          const id = (it.getAttribute('id') || '').trim();
          const desc = decodificarTextoItemAjax(it.getAttribute('descricao') || it.textContent || '');
          const compl = decodificarTextoItemAjax(it.getAttribute('complemento') || '');
          if (id && desc) {
            mapa.set(id, { id, descricao: desc, complemento: compl });
          }
        });
      } catch (e) {}

      const reTag = /<item\b([^>]*)\/?>/gi;
      let mTag;
      while ((mTag = reTag.exec(txt)) !== null) {
        const attrs = mTag[1] || '';
        const mId = attrs.match(/\bid=["']([^"']+)["']/i);
        const mDesc = attrs.match(/\bdescricao=["']([^"']+)["']/i);
        const mCompl = attrs.match(/\bcomplemento=["']([^"']*)["']/i);
        if (mId && mDesc) {
          const id = mId[1].trim();
          const desc = decodificarTextoItemAjax(mDesc[1]);
          const compl = mCompl ? decodificarTextoItemAjax(mCompl[1]) : '';
          if (id && desc && !mapa.has(id)) {
            mapa.set(id, { id, descricao: desc, complemento: compl });
          }
        }
      }
    };

    // 1. Consulta o catálogo completo de eventos da tela (equivalente ao botão "Listar Todos")
    if (url && !window._eprocCatalogoGeralEventosMovimentacaoCarregado) {
      try {
        const respAll = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: '',
          credentials: 'same-origin'
        });
        if (respAll.ok) {
          const txtAll = await lerRespostaTexto(respAll);
          extrairItensDeXml(txtAll);
        }
      } catch (e) {
        console.warn('Erro ao carregar catálogo geral de eventos de movimentação:', e);
      }
      if (mapa.size > 0) {
        window._eprocCatalogoGeralEventosMovimentacaoCarregado = true;
      }
    }

    // 2. Se houver itens já carregados na instância objAjaxAutoCompEvento
    if (window.objAjaxAutoCompEvento && Array.isArray(window.objAjaxAutoCompEvento.arrItens)) {
      window.objAjaxAutoCompEvento.arrItens.forEach(it => {
        const id = String(it.id || '').trim();
        const desc = decodificarTextoItemAjax(it.descricao || it.text || '');
        const compl = decodificarTextoItemAjax(it.complemento || '');
        if (id && desc && !mapa.has(id)) {
          mapa.set(id, { id, descricao: desc, complemento: compl });
        }
      });
    }

    // 3. Se foi solicitado um termo específico, faz busca pontual por partícula
    const termoLimpo = String(termoOpcional || '').trim();
    if (url && termoLimpo) {
      const bodies = Array.from(new Set([
        montarBodyParticulaInfraAjax(termoLimpo),
        'particula=' + encodeURIComponent(termoLimpo),
        ...(/[^\x00-\x7F]/.test(termoLimpo) ? ['particula=' + codificarParticula(termoLimpo, true)] : [])
      ]));
      for (const bodyStr of bodies) {
        try {
          const respTermo = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: bodyStr,
            credentials: 'same-origin'
          });
          if (respTermo.ok) {
            const txtTermo = await lerRespostaTexto(respTermo);
            extrairItensDeXml(txtTermo);
          }
        } catch (e) {}
      }
    }

    return Array.from(mapa.values());
  }

  function encontrarEventoMovimentacao(nomeEventoBruto, codEventoBruto, listaCandidatos) {
    if (!nomeEventoBruto || !Array.isArray(listaCandidatos) || listaCandidatos.length === 0) return null;

    const alvoDesc = limparDescEventoMov(nomeEventoBruto);
    const alvoTokens = tokensSignificativosEventoMov(nomeEventoBruto);
    const alvoTokensStr = alvoTokens.join(' ');
    if (!alvoDesc || alvoTokens.length === 0) return null;

    const mCod = String(nomeEventoBruto || '').match(/\((\d+)\)/);
    const codLimpo = (codEventoBruto && codEventoBruto !== '-') ? String(codEventoBruto).trim() : (mCod ? mCod[1] : '');

    // Filtra candidatos que possuem o mesmo código (ex.: 51 ou 123), mas usa a descrição/tokens como critério obrigatório!
    const candsComCod = codLimpo
      ? listaCandidatos.filter(c => {
          const cid = String(c.id || '').trim();
          const cdesc = String(c.descricao || '');
          return cid === codLimpo || cdesc.includes('(' + codLimpo + ')');
        })
      : listaCandidatos;

    const pools = (candsComCod.length > 0 && candsComCod.length < listaCandidatos.length)
      ? [candsComCod, listaCandidatos]
      : [listaCandidatos];

    for (const pool of pools) {
      // TIER 1: Descrição normalizada (sem código entre parênteses) idêntica
      let achou = pool.find(c => limparDescEventoMov(c.descricao) === alvoDesc);
      if (achou) return achou;

      // TIER 2: Sequência de palavras significativas idêntica (ignora preposições como "para", "de", "os", "em")
      achou = pool.find(c => tokensSignificativosEventoMov(c.descricao).join(' ') === alvoTokensStr);
      if (achou) return achou;

      // TIER 3: Mesmo conjunto exato de palavras significativas (independente da ordem)
      achou = pool.find(c => {
        const ct = tokensSignificativosEventoMov(c.descricao);
        return ct.length === alvoTokens.length && alvoTokens.every(t => ct.includes(t));
      });
      if (achou) return achou;

      // TIER 4: Candidato contém todas as palavras significativas do evento da planilha (escolhe o mais conciso)
      if (alvoTokens.length >= 2) {
        const contendoTodos = pool
          .map(c => ({ c, ct: tokensSignificativosEventoMov(c.descricao) }))
          .filter(x => alvoTokens.every(t => x.ct.includes(t)))
          .sort((a, b) => Math.abs(a.ct.length - alvoTokens.length) - Math.abs(b.ct.length - alvoTokens.length));
        if (contendoTodos.length > 0) return contendoTodos[0].c;
      }

      // TIER 5: Evento da planilha contém todas as palavras significativas do candidato (exigindo a palavra distintiva final)
      if (alvoTokens.length >= 2) {
        const ultimoTokenAlvo = alvoTokens[alvoTokens.length - 1];
        const contidoNoAlvo = pool
          .map(c => ({ c, ct: tokensSignificativosEventoMov(c.descricao) }))
          .filter(x => x.ct.length >= 2 && x.ct.includes(ultimoTokenAlvo) && x.ct.every(t => alvoTokens.includes(t)))
          .sort((a, b) => b.ct.length - a.ct.length);
        if (contidoNoAlvo.length > 0) return contidoNoAlvo[0].c;
      }
    }

    return null;
  }

  async function selecionarEventoMovimentacao(item) {
    const txtEvento = document.getElementById('txtEvento');
    const hdnEvento = document.getElementById('hdnEvento');
    if (!txtEvento || !hdnEvento) {
      throw new Error('Campos de evento (#txtEvento / #hdnEvento) não encontrados na tela de Movimentação Processual.');
    }

    const nomeEvento = String(item.evento || '').trim();
    const codEvento = String(item.eventoCod || '').trim();
    if (!nomeEvento) {
      throw new Error(`A preferência "${item.nome}" não possui evento informado na planilha.`);
    }

    addLog(`🔎 Localizando evento pela descrição: "${nomeEvento}"${codEvento ? ` (cód. ref: ${codEvento})` : ''}...`);

    // 1. Busca no catálogo completo carregado do eproc
    let catalogo = await obterCatalogoEventosMovimentacao();
    let achou = encontrarEventoMovimentacao(nomeEvento, codEvento, catalogo);

    // 2. Se ainda não achou, consulta o endpoint AJAX com partículas extraídas do nome do evento e do código
    if (!achou) {
      const semCod = nomeEvento.replace(/\(\s*\d+\s*\)/g, '').trim();
      const partesHifen = semCod.split(/\s*[-–—]\s*/).map(s => s.trim()).filter(Boolean);
      const tokensSig = tokensSignificativosEventoMov(nomeEvento);
      const termosBusca = Array.from(new Set([
        semCod,
        ...(partesHifen.length > 1 ? [partesHifen[partesHifen.length - 1], partesHifen[0]] : []),
        ...(tokensSig.length >= 2 ? [tokensSig.slice(-2).join(' '), tokensSig[tokensSig.length - 1], tokensSig[0]] : []),
        ...(codEvento && codEvento !== '-' ? [codEvento] : [])
      ])).filter(t => t && t.length >= 2);

      for (const termo of termosBusca) {
        catalogo = await obterCatalogoEventosMovimentacao(termo);
        achou = encontrarEventoMovimentacao(nomeEvento, codEvento, catalogo);
        if (achou) break;
      }
    }

    // 3. Fallback via autocomplete visual na tela caso o fetch direto não tenha retornado
    if (!achou && window.objAjaxAutoCompEvento && typeof window.objAjaxAutoCompEvento.executar === 'function') {
      const semCod = nomeEvento.replace(/\(\s*\d+\s*\)/g, '').trim();
      txtEvento.focus();
      txtEvento.value = semCod.slice(0, 28);
      dispararEventos(txtEvento, ['input', 'keydown', 'keyup', 'change']);
      try { window.objAjaxAutoCompEvento.executar(); } catch (e) {}
      await esperarMenuAutocomplete('divInfraAjaxtxtEvento', 2000);
      const arr = Array.isArray(window.objAjaxAutoCompEvento.arrItens) ? window.objAjaxAutoCompEvento.arrItens : [];
      achou = encontrarEventoMovimentacao(nomeEvento, codEvento, arr);
    }

    if (!achou) {
      throw new Error(`Evento "${nomeEvento}" não localizado no catálogo de Movimentação Processual da Unidade.`);
    }

    // Aplica o evento selecionado nos campos oficiais do eproc
    hdnEvento.value = achou.id;
    txtEvento.value = achou.descricao;
    dispararEventos(txtEvento, ['input', 'change']);

    if (window.objAjaxAutoCompEvento && typeof window.objAjaxAutoCompEvento.processarResultado === 'function') {
      try {
        window.objAjaxAutoCompEvento.processarResultado(achou.id, achou.descricao, achou.complemento || 'null');
      } catch (e) {}
    } else {
      if (window.objAjaxEventoDados && typeof window.objAjaxEventoDados.executar === 'function') {
        try { window.objAjaxEventoDados.executar(); } catch (e) {}
      }
      if (typeof window.prepararMovimentacao === 'function') {
        try { window.prepararMovimentacao(achou.id); } catch (e) {}
      }
      if (typeof window.buscaEventosComplementares === 'function') {
        try { window.buscaEventosComplementares(achou.id); } catch (e) {}
      }
    }

    // Aguarda concluir o carregamento de prepararMovimentacao (#divExibeLoading / #divExibeHTML)
    const divLoading = document.getElementById('divExibeLoading');
    let aguardou = 0;
    while (aguardou < 3500) {
      const carregando = divLoading && divLoading.style.display !== 'none' && divLoading.offsetParent !== null;
      if (!carregando && aguardou >= 300) break;
      await sleep(150);
      aguardou += 150;
    }

    // Reafirma o ID e a descrição do evento após o callback de montarTela
    hdnEvento.value = achou.id;
    txtEvento.value = achou.descricao;
    destacarCampoAtivo(txtEvento, 'Evento Definido', `${achou.descricao} [ID: ${achou.id}]`);
    addLog(`✅ Evento selecionado: "${achou.descricao}" (ID interno: ${achou.id})`);
    return achou;
  }

  function resetarFormularioMovimentacao() {
    try {
      if (typeof window.limparCamposPreferencia === 'function') {
        try { window.limparCamposPreferencia(); } catch (e) {}
      }
      if (typeof window.limparCpsFormPref === 'function') {
        try { window.limparCpsFormPref(); } catch (e) {}
      }

      const txtEv = document.getElementById('txtEvento');
      const hdnEv = document.getElementById('hdnEvento');
      if (txtEv) txtEv.value = '';
      if (hdnEv) hdnEv.value = '';

      const hdnPref = document.getElementById('hdnPreferencia');
      const txtPref = document.getElementById('txtPreferencia');
      if (hdnPref) hdnPref.value = '';
      if (txtPref) txtPref.value = '';

      const selDes = document.getElementById('selLocalizadorDesativar');
      if (selDes) {
        Array.from(selDes.options).forEach(o => {
          o.selected = false;
          o.removeAttribute('selected');
        });
        if (window.$) {
          try { window.$('#selLocalizadorDesativar option').prop('selected', false); } catch (e) {}
        }
      }

      const selNovo = document.getElementById('selNovoLocalizador');
      if (selNovo) {
        selNovo.value = 'null';
        dispararEventos(selNovo, ['change']);
      }

      const chkSec = document.getElementById('chkLocalizadoresSecundarios');
      const selSec = document.getElementById('selLocalizadorSecundario');
      if (chkSec) {
        chkSec.checked = false;
        dispararEventos(chkSec, ['change']);
      }
      if (selSec) {
        Array.from(selSec.options).forEach(o => { o.selected = false; });
        if (window.jQuery && window.jQuery(selSec).multipleSelect) {
          try {
            window.jQuery(selSec).multipleSelect('uncheckAll');
            window.jQuery(selSec).multipleSelect('setSelects', []);
            window.jQuery(selSec).multipleSelect('refresh');
          } catch (e) {}
        }
      }

      limparEventosComplementares();
      window._eprocGrupoAtualId = null;
    } catch (e) {
      console.warn('Erro ao resetar formulário de movimentação:', e);
    }
  }

  async function executarDiagnosticoPreVooMovimentacoes() {
    if (!itensCarregados || itensCarregados.length === 0) {
      alertOriginal.call(window, 'Carregue primeiro a planilha unificada antes de executar a Verificação prévia.');
      return;
    }

    const btnDiag = document.getElementById('btn-rito-diagnostico');
    const btnIni = document.getElementById('btn-rito-iniciar');
    if (btnDiag) {
      btnDiag.disabled = true;
      btnDiag.classList.add('rito-diagnostico-ativo');
      btnDiag.innerHTML = '<span>⏳</span> Verificando (0%)...';
    }
    if (btnIni) btnIni.disabled = true;

    try {
      addLog('🔍 Iniciando Verificação prévia: Módulo Movimentações...');
      atualizarProgressoDiagnostico(15, 'Etapa 1/3', '1. Mapeando Localizadores de Destino na Unidade...', true);
      await sleep(80);

      const selNovo = document.getElementById('selNovoLocalizador');
      const optsNovo = selNovo ? Array.from(selNovo.options) : [];
      let locsOk = 0;
      let locsFallback = 0;

      for (const it of itensCarregados) {
        if (!it.novoLocalizador) {
          locsOk++;
          continue;
        }
        const opt = acharOpcaoLocalizador(optsNovo, it.novoLocalizador, false);
        if (opt) {
          locsOk++;
        } else {
          locsFallback++;
          addLog(`⚠️ Linha ${it.linha} ("${it.nome}"): Novo Localizador "${it.novoLocalizador}" não encontrado na Unidade (usará Fallback).`, 'warn');
        }
      }
      addLog(`✓ Localizadores de destino: ${locsOk}/${itensCarregados.length} encontrados na Unidade.`);

      atualizarProgressoDiagnostico(55, 'Etapa 2/3', '2. Validando Eventos de Movimentação (pelo nome e código)...', true);
      await sleep(80);

      let catalogoEv = await obterCatalogoEventosMovimentacao();
      let evsOk = 0;
      let evsFaltantes = 0;

      for (const it of itensCarregados) {
        let achouEv = encontrarEventoMovimentacao(it.evento, it.eventoCod, catalogoEv);
        if (!achouEv && it.evento) {
          const semCod = String(it.evento).replace(/\(\s*\d+\s*\)/g, '').trim();
          catalogoEv = await obterCatalogoEventosMovimentacao(semCod);
          achouEv = encontrarEventoMovimentacao(it.evento, it.eventoCod, catalogoEv);
        }
        if (achouEv) {
          evsOk++;
          addLog(`✓ Evento #${it.num}: "${it.evento}" ➔ "${achouEv.descricao}" (ID: ${achouEv.id})`);
        } else {
          evsFaltantes++;
          addLog(`❌ Evento #${it.num} não localizado: "${it.evento}" (Cód: ${it.eventoCod || '-'})`, 'warn');
        }
      }

      atualizarProgressoDiagnostico(85, 'Etapa 3/3', '3. Verificando Grupos e Preferências Já Cadastradas...', true);
      await sleep(80);

      const gruposPlanilha = Array.from(new Set(itensCarregados.map(it => it.grupo).filter(g => g && g !== '-')));
      if (gruposPlanilha.length === 0) {
        addLog('ℹ️ Coluna "Grupo de preferência" está vazia: nenhum grupo será criado ou vinculado.');
      } else {
        const gruposCadastrados = await obterGruposCadastradosNoEproc2G();
        const gruposFaltantes = gruposPlanilha.filter(g => !gruposCadastrados.has(normalizar(g)));
        addLog(`✓ Grupos na planilha: ${gruposPlanilha.length} (${gruposFaltantes.length} novos a criar).`);
      }

      const existentes = await obterPreferenciasExistentes();
      let jaExistemCount = 0;
      itensCarregados.forEach(it => {
        if (preferenciaJaExiste(it.nome, existentes)) jaExistemCount++;
      });

      atualizarProgressoDiagnostico(100, 'Concluído', 'Verificação prévia de Movimentações concluída!', false);

      addLog('=== RELATÓRIO DA VERIFICAÇÃO PRÉVIA (MOVIMENTAÇÕES) ===');
      addLog('• Total de preferências na planilha: ' + itensCarregados.length);
      addLog('• Eventos validados pelo nome: ' + evsOk + ' / ' + itensCarregados.length);
      addLog('• Localizadores de destino encontrados: ' + locsOk + ' / ' + itensCarregados.length);
      addLog('• Grupos a vincular: ' + (gruposPlanilha.length === 0 ? 'Nenhum (coluna vazia)' : gruposPlanilha.length));
      addLog('• Preferências já existentes na Unidade: ' + jaExistemCount + (jaExistemCount > 0 ? ' (serão puladas automaticamente)' : ''));
      addLog('✅ Auditoria de Movimentação Processual concluída!', 'success');
    } catch (err) {
      console.error('Erro na verificação de movimentações:', err);
      addLog('❌ Erro na verificação prévia de Movimentações: ' + (err.message || err), 'error');
      atualizarProgressoDiagnostico(100, 'Falha', 'Erro na verificação: ' + (err.message || err), false);
    } finally {
      if (btnDiag) {
        btnDiag.disabled = false;
        btnDiag.classList.remove('rito-diagnostico-ativo');
        btnDiag.innerHTML = '<span>🔍</span> Verificação prévia';
      }
      if (btnIni) btnIni.disabled = false;
    }
  }

  async function executarPassoAPassoMovimentacao(item) {
    if (window._eprocPararLote) throw new Error('PARADA_SOLICITADA');

    ultimoAvisoEproc = '';
    gravacaoEmAndamento = true;
    window._eprocGrupoAtualId = null;
    window._eprocEventosCompAtuais = [];

    resetarFormularioMovimentacao();
    await sleep(150);

    const dados = {
      linha: item.linha,
      nome: item.nome,
      tipoPref: item.tipo || 'Unidade',
      grupo: '(Nenhum)',
      comoSalvar: 'Localizadores selecionados',
      acaoPref: item.acaoPreferencial ? 'Marcada' : 'Não marcada',
      evento: item.evento,
      eventosComp: [],
      comportamento: item.comportamento || 'NÃO remover de localizador algum',
      locPrincipal: '',
      locPrincipalFallback: false,
      locSecundarios: [],
      locSecundariosFallback: false,
      locDesativar: '(Nenhum)',
      sucesso: false
    };

    try {
      // 1. Abre o subformulário de Preferências (#divPrefOpcoes)
      if (typeof window.exibirFormPreferencias === 'function') {
        try { window.exibirFormPreferencias('salvar'); } catch (e) {}
      } else {
        const btnSalvar = document.getElementById('btnSalvarPreferencias');
        if (btnSalvar) dispararClique(btnSalvar);
      }
      if (typeof window.exibeOcultaItens === 'function') {
        try { window.exibeOcultaItens(false); } catch (e) {}
      }
      const divOpcoes = document.getElementById('divPrefOpcoes');
      if (divOpcoes) divOpcoes.style.display = 'block';
      const hdnAcao = document.getElementById('hdnAcaoPreferencia');
      if (hdnAcao) hdnAcao.value = 'salvar';
      const hdnPref = document.getElementById('hdnPreferencia');
      if (hdnPref) hdnPref.value = '';
      await sleep(200);
      if (window._eprocPararLote) throw new Error('PARADA_SOLICITADA');

      // 2. Nome da Preferência (#txtDescricaoCadastro)
      const txtDescricaoCadastro = document.getElementById('txtDescricaoCadastro');
      if (!txtDescricaoCadastro) throw new Error('Campo txtDescricaoCadastro não encontrado na tela de Movimentação Processual.');
      destacarCampoAtivo(txtDescricaoCadastro, 'Nome da Preferência', item.nome);
      txtDescricaoCadastro.disabled = false;
      txtDescricaoCadastro.value = item.nome;
      dispararEventos(txtDescricaoCadastro, ['input', 'change', 'blur']);

      // 3. Tipo de Preferência (#rdUnidade / #rdIndividual)
      if (window.jQuery) {
        window.jQuery('input[name=rdPrefTipo]').prop('disabled', false);
      }
      const usarIndividual = normalizar(item.tipo) === 'individual';
      const rdTipoAlvo = document.getElementById(usarIndividual ? 'rdIndividual' : 'rdUnidade');
      if (rdTipoAlvo) {
        destacarCampoAtivo(rdTipoAlvo, 'Tipo de Preferência', usarIndividual ? 'Individual' : 'Unidade');
        rdTipoAlvo.checked = true;
        dispararEventos(rdTipoAlvo, ['change', 'click']);
      }

      // 4. Grupo de Preferência (#selFormularioPersonalizacaoGrupo)
      // REGRA ESTRITA: Se a coluna "Grupo de preferência" estiver vazia, NÃO cria grupo algum nem vincula a qualquer grupo!
      const selGrupoEl = document.getElementById('selFormularioPersonalizacaoGrupo');
      const temGrupoDefinido = !!(item.grupo && String(item.grupo).trim() !== '' && String(item.grupo).trim() !== '-' && normalizar(item.grupo) !== 'nenhum');

      if (temGrupoDefinido && !usarIndividual) {
        const objGrp = await gerenciarGrupoPreferencia2G(item.grupo);
        if (objGrp && objGrp.id) {
          dados.grupo = objGrp.text;
          window._eprocGrupoAtualId = String(objGrp.id);
        }
        await sleep(150);
      } else {
        window._eprocGrupoAtualId = null;
        dados.grupo = '(Nenhum)';
        if (selGrupoEl) {
          Array.from(selGrupoEl.options).forEach(o => {
            o.selected = (o.value === 'null' || o.value === '');
          });
          selGrupoEl.value = 'null';
          dispararEventos(selGrupoEl, ['change']);
        }
      }

      // 5. Seleção do Evento Judicial (desambiguando pelo Nome exato da planilha + confirmação de código)
      const evSelecionado = await selecionarEventoMovimentacao(item);
      if (evSelecionado && evSelecionado.descricao) {
        dados.evento = evSelecionado.descricao;
      }
      if (window._eprocPararLote) throw new Error('PARADA_SOLICITADA');
      await sleep(200);

      // 6. Eventos Complementares (se informados na planilha)
      if (item.eventosComplementares && item.eventosComplementares.length > 0) {
        await selecionarEventosComplementares(item.eventosComplementares, dados);
        await sleep(200);
      } else {
        limparEventosComplementares();
      }

      // 7. Configuração de Localizadores (#fldAlterarLocalizadores)
      const fldLoc = document.getElementById('fldAlterarLocalizadores');
      const contLoc = document.getElementById('conteudoAlterarLocalizadores');
      const divPrefLoc = document.getElementById('divPrefLocalizadores');
      if (fldLoc) fldLoc.style.display = 'block';
      if (contLoc) contLoc.style.display = 'block';
      if (divPrefLoc) divPrefLoc.style.display = 'block';

      // 7a. Novo Localizador (Destino) (#selNovoLocalizador)
      const selNovoLoc = document.getElementById('selNovoLocalizador');
      let achouPrincipal = false;
      if (selNovoLoc) {
        const primDesejado = item.novoLocalizador || (item.localizadores && item.localizadores[0]) || '';
        destacarCampoAtivo(selNovoLoc, 'Novo Localizador (Destino)', primDesejado || 'MANTER LOCALIZADOR ATUAL');

        if (primDesejado) {
          const optP = acharOpcaoLocalizador(selNovoLoc, primDesejado, false);
          if (optP) {
            selNovoLoc.value = optP.value;
            optP.selected = true;
            achouPrincipal = true;
            dados.locPrincipal = optP.text.trim();
          } else {
            const optFallback = acharOpcaoLocalizador(selNovoLoc, 'ARQUIVO - ARQUIVO', true) ||
                                Array.from(selNovoLoc.options).find(o => o.value === 'null');
            if (optFallback) {
              selNovoLoc.value = optFallback.value;
              optFallback.selected = true;
            }
            dados.locPrincipal = `⚠️ "${optFallback ? optFallback.text.trim() : 'ARQUIVO - ARQUIVO'}" (Fallback: "${primDesejado}" não encontrado na Unidade)`;
            dados.locPrincipalFallback = true;
          }
        } else {
          selNovoLoc.value = 'null';
          achouPrincipal = true;
          dados.locPrincipal = 'MANTER LOCALIZADOR ATUAL';
        }

        dispararEventos(selNovoLoc, ['change']);
        if (typeof window.habilitarLocalizadoresSecundarios === 'function') {
          try { window.habilitarLocalizadoresSecundarios(selNovoLoc); } catch (e) {}
        }
        await sleep(200);
      }

      // 7b. Localizadores Secundários (#chkLocalizadoresSecundarios / #selLocalizadorSecundario)
      const chkSec = document.getElementById('chkLocalizadoresSecundarios');
      const selSec = document.getElementById('selLocalizadorSecundario');
      if (chkSec && selSec) {
        const secsDesejados = item.localizadoresSecundarios || [];
        if (secsDesejados.length > 0) {
          chkSec.disabled = false;
          chkSec.checked = true;
          dispararEventos(chkSec, ['change', 'click']);
          if (typeof window.chkLocalizadoresSecundariosOnClick === 'function') {
            try { window.chkLocalizadoresSecundariosOnClick(chkSec); } catch (e) {}
          }
          await sleep(150);

          const valoresSec = [];
          const nomesSec = [];
          secsDesejados.forEach(desejado => {
            const o = acharOpcaoLocalizador(selSec, desejado, false);
            if (o && o.value && o.value !== 'null') {
              o.selected = true;
              valoresSec.push(o.value);
              nomesSec.push(o.text.trim());
            }
          });
          if (window.jQuery && window.jQuery(selSec).multipleSelect) {
            try {
              window.jQuery(selSec).multipleSelect('setSelects', valoresSec);
              window.jQuery(selSec).multipleSelect('refresh');
            } catch (e) {}
          }
          dados.locSecundarios = nomesSec.length > 0 ? nomesSec : ['(Nenhum)'];
          dispararEventos(selSec, ['change']);
        } else {
          chkSec.checked = false;
          Array.from(selSec.options).forEach(o => { o.selected = false; });
          if (window.jQuery && window.jQuery(selSec).multipleSelect) {
            try {
              window.jQuery(selSec).multipleSelect('uncheckAll');
              window.jQuery(selSec).multipleSelect('setSelects', []);
              window.jQuery(selSec).multipleSelect('refresh');
            } catch (e) {}
          }
          dados.locSecundarios = ['(Nenhum)'];
        }
      }

      // 7c. Localizadores Atuais a Desativar (#selLocalizadorDesativar) e Como salvar seleção (#rdIndividuais)
      // Importante: executado APÓS selNovoLocalizador para anular eventual seleção automática de idLocalizadorOrgaoPesquisado
      const selDesativar = document.getElementById('selLocalizadorDesativar');
      if (selDesativar) {
        Array.from(selDesativar.options).forEach(o => {
          o.selected = false;
          o.removeAttribute('selected');
        });
        if (window.$) {
          try { window.$('#selLocalizadorDesativar option').prop('selected', false); } catch (e) {}
        }

        if (item.localizadoresDesativar && item.localizadoresDesativar.length > 0) {
          const desativadosNomes = [];
          for (const locDes of item.localizadoresDesativar) {
            let optD = acharOpcaoLocalizador(selDesativar, locDes, false);
            if (!optD && selNovoLoc) {
              // Se o localizador a desativar não estiver no processo atual, busca seu ID no select geral e injeta a option
              const optRef = acharOpcaoLocalizador(selNovoLoc, locDes, false);
              if (optRef && optRef.value && optRef.value !== 'null') {
                optD = document.createElement('option');
                optD.value = optRef.value;
                optD.text = optRef.text;
                selDesativar.appendChild(optD);
              }
            }
            if (optD) {
              optD.selected = true;
              optD.setAttribute('selected', 'selected');
              desativadosNomes.push(optD.text.trim());
            }
          }
          dados.locDesativar = desativadosNomes.length > 0 ? desativadosNomes.join('; ') : '(Nenhum)';
        } else {
          dados.locDesativar = '(Nenhum - NÃO remover de localizador algum)';
        }
      }

      // 8. Radio "Como salvar seleção de localizadores": Localizadores selecionados (#rdIndividuais, value="L")
      if (window.jQuery) {
        window.jQuery('input[name=rdPrefLocalizadores]').prop('disabled', false);
      }
      const rdIndividuais = document.getElementById('rdIndividuais');
      if (rdIndividuais) {
        destacarCampoAtivo(rdIndividuais, 'Como Salvar Localizadores', 'Localizadores selecionados');
        rdIndividuais.disabled = false;
        rdIndividuais.checked = true;
        dispararEventos(rdIndividuais, ['change', 'click']);
      }

      // Garante novamente que nenhuma opção em #selLocalizadorDesativar ficou marcada quando a coluna está vazia
      if (selDesativar && (!item.localizadoresDesativar || item.localizadoresDesativar.length === 0)) {
        Array.from(selDesativar.options).forEach(o => {
          o.selected = false;
          o.removeAttribute('selected');
        });
        if (window.$) {
          try { window.$('#selLocalizadorDesativar option').prop('selected', false); } catch (e) {}
        }
      }

      // 9. Opções: Ação Preferencial (#chkMovPreferencial) e Marcar como padrão (#chkValorPadrao)
      if (divOpcoes) divOpcoes.style.display = 'block';
      const chkMovPref = document.getElementById('chkMovPreferencial');
      if (chkMovPref) {
        chkMovPref.disabled = false;
        chkMovPref.style.display = '';
        if (chkMovPref.parentElement) chkMovPref.parentElement.style.display = '';
        chkMovPref.checked = !!item.acaoPreferencial;
        destacarCampoAtivo(chkMovPref, 'Opção', item.acaoPreferencial ? 'Ação Preferencial (Marcada)' : 'Ação Preferencial (Desmarcada)');
        dispararEventos(chkMovPref, ['change']);
      }

      const chkPadrao = document.getElementById('chkValorPadrao');
      if (chkPadrao) {
        chkPadrao.disabled = false;
        chkPadrao.checked = !!item.padrao;
        dispararEventos(chkPadrao, ['change']);
      }

      // 10. Reafirma Tipo de Preferência e Grupo antes da gravação
      if (rdTipoAlvo) {
        rdTipoAlvo.checked = true;
        dispararEventos(rdTipoAlvo, ['change', 'click']);
      }
      if (selGrupoEl) {
        if (temGrupoDefinido && window._eprocGrupoAtualId) {
          selGrupoEl.disabled = false;
          selGrupoEl.value = window._eprocGrupoAtualId;
          const optMatch = Array.from(selGrupoEl.options).find(o => o.value === window._eprocGrupoAtualId);
          if (optMatch) optMatch.selected = true;
        } else {
          // Garante que <option value="null"> esteja selecionada para enviar selGrupo='null' (sem grupo)
          let optNull = Array.from(selGrupoEl.options).find(o => o.value === 'null' || o.value === '');
          if (!optNull) {
            optNull = document.createElement('option');
            optNull.value = 'null';
            optNull.text = '';
            selGrupoEl.insertBefore(optNull, selGrupoEl.firstChild);
          }
          Array.from(selGrupoEl.options).forEach(o => { o.selected = (o === optNull); });
          selGrupoEl.value = optNull.value;
        }
      }

      instalarHookGravarPreferencias();
      await sleep(150);

      // 11. Gravação da Preferência (#btnOK / validarPreferencias)
      const btnOK = document.getElementById('btnOK');
      if (btnOK) {
        btnOK.disabled = false;
        destacarCampoAtivo(btnOK, 'Salvar Preferência', `Gravando: ${item.nome}`);
        dispararClique(btnOK);
      } else if (typeof window.validarPreferencias === 'function') {
        window.validarPreferencias();
      }

      let aguardouSave = 0;
      while (aguardouSave < 5000) {
        if (window._eprocPararLote) break;
        await sleep(250);
        aguardouSave += 250;
        if (ultimoAvisoEproc) {
          const avisoNorm = normalizar(ultimoAvisoEproc);
          if (avisoNorm.includes('cadastrada') || avisoNorm.includes('atualizada') || avisoNorm.includes('sucesso')) {
            break;
          }
          if (avisoNorm.includes('erro') || avisoNorm.includes('ja existe') || avisoNorm.includes('mesma descricao')) {
            break;
          }
        }
        if (btnOK && !btnOK.disabled && aguardouSave > 1200) {
          break;
        }
      }

      if (ultimoAvisoEproc) {
        const avisoNorm = normalizar(ultimoAvisoEproc);
        if (avisoNorm.includes('ja existe') || avisoNorm.includes('mesma descricao')) {
          throw new Error('DUPLICADA: ' + ultimoAvisoEproc);
        }
        if (avisoNorm.includes('erro') || avisoNorm.includes('falha') || avisoNorm.includes('nao foi possivel') || avisoNorm.includes('informe a descricao')) {
          throw new Error(ultimoAvisoEproc);
        }
      }

      addLog(`✅ Preferência de Movimentação gravada com sucesso: "${item.nome}"`, 'success');
      dados.sucesso = true;
      return dados;
    } finally {
      removerDestaqueCampo();
      gravacaoEmAndamento = false;
    }
  }

  async function executarPassoAPassoItemMinuta(item) {

    if (window._eprocPararLote) throw new Error('PARADA_SOLICITADA');



    ultimoAvisoEproc = '';

    gravacaoEmAndamento = true;



    // LIMPEZA PREVENTIVA: Garante estado limpo e isolado antes de preencher cada item

    resetarFormularioCompletamente();

    await sleep(150);



    const dados = {

      linha: item.linha,

      nome: item.nome,

      tipoPref: 'Unidade',

      comoSalvar: 'Localizadores selecionados',

      acaoPref: 'Marcada',

      modelo: '',

      agendamento: 'Habilitado',

      evento: item.evento,

      comportamento: 'NÃO remover de localizador algum (3)',

      locPrincipal: '',

      locPrincipalFallback: false,

      locSecundarios: [],

      locSecundariosFallback: false,

      classificacao: item.classificacao || '',

      descricao: item.descricao || '',

      assinante: '',

      statusDestino: 'Para assinar (4)',

      eventosComp: [],

      dadosComplementares: '',

      sucesso: false,

      erro: null

    };



    try {

      // 0. Abertura do subformulário de Preferências (#divPrefOpcoes)

      if (typeof window.exibirFormPreferencias === 'function') {

        try { window.exibirFormPreferencias('salvar'); } catch (e) {}

      } else {

        const btnSalvar = document.getElementById('btnSalvarPreferencias');

        if (btnSalvar) dispararClique(btnSalvar);

      }

      if (typeof window.exibeOcultaItens === 'function') {

        try { window.exibeOcultaItens(false); } catch (e) {}

      }

      const divOpcoes = document.getElementById('divPrefOpcoes');

      if (divOpcoes) divOpcoes.style.display = 'block';

      const hdnAcao = document.getElementById('hdnAcaoPreferencia');

      if (hdnAcao) hdnAcao.value = 'salvar';

      await sleep(250);

      if (window._eprocPararLote) throw new Error('PARADA_SOLICITADA');



      // Configuração: Nome da preferência (Coluna D)

      const txtDescricaoCadastro = document.getElementById('txtDescricaoCadastro');

      if (!txtDescricaoCadastro) throw new Error('Campo txtDescricaoCadastro não encontrado.');

      destacarCampoAtivo(txtDescricaoCadastro, 'Nome', item.nome);

      txtDescricaoCadastro.value = item.nome;

      dispararEventos(txtDescricaoCadastro, ['input', 'change', 'blur']);



      // Configuração: Botão radio Tipo de preferência: marcar Unidade

      if (window.jQuery) {

        window.jQuery('input[name=rdPrefTipo]').prop('disabled', false);

      }

      const rdUnidade = document.getElementById('rdUnidade');

      if (rdUnidade) {

        destacarCampoAtivo(rdUnidade, 'Tipo', 'Unidade');

        rdUnidade.checked = true;

        dispararEventos(rdUnidade, ['change', 'click']);

      }



      // Configuração: Botão radio Como salvar seleção de localizadores: marcar Localizadores selecionados

      if (window.jQuery) {

        window.jQuery('input[name=rdPrefLocalizadores]').prop('disabled', false);

      }

      const rdIndividuais = document.getElementById('rdIndividuais');

      if (rdIndividuais) {

        destacarCampoAtivo(rdIndividuais, 'Localizadores', 'Localizadores selecionados');

        rdIndividuais.checked = true;

        dispararEventos(rdIndividuais, ['change', 'click']);

      }



      // Configuração: Checkbox Opções: marcar Ação preferencial

      const chkMovPref = document.getElementById('chkMovPreferencial');

      if (chkMovPref) {

        destacarCampoAtivo(chkMovPref, 'Opção', 'Ação preferencial');

        chkMovPref.checked = true;

        dispararEventos(chkMovPref, ['change']);

      }



      // Configuração: Tipo de documento / Modelo

      const txtModeloPre = document.getElementById('txtModelo');

      if (txtModeloPre) {

        destacarCampoAtivo(txtModeloPre, 'Modelo', item.modeloNome || item.modeloGenericoFixo || '(Modelo da Planilha)');

      }

      const modeloOk = await selecionarModelo(item);

      if (window._eprocPararLote) throw new Error('PARADA_SOLICITADA');

      const hdnIdModeloCheck = document.getElementById('hdnIdModelo');

      if (!modeloOk || !hdnIdModeloCheck || !hdnIdModeloCheck.value) {

        throw new Error(`Modelo não localizado para "${item.nome}". Operação cancelada para não gravar preferência sem modelo.`);

      }

      const txtModeloEl = document.getElementById('txtModelo');

      dados.modelo = (txtModeloEl && txtModeloEl.value) ? txtModeloEl.value : (item.modeloNome || '(Modelo Genérico)');

      destacarCampoAtivo(txtModeloEl || txtModeloPre, 'Modelo Definido', dados.modelo);

      await sleep(250);



      // Configuração: Checkbox: Agendar lançamento de evento/troca de localizador

      const chkAgendamento = document.getElementById('chkEventoAgendamento');

      if (chkAgendamento) {

        destacarCampoAtivo(chkAgendamento, 'Agendamento', 'Agendar lançamento de evento/troca de localizador');

        chkAgendamento.checked = true;

        dispararEventos(chkAgendamento, ['change', 'click']);

        if (typeof window.marcarAgendamento === 'function') {

          try { window.marcarAgendamento(); } catch (e) {}

        }

        await sleep(250);

      }

      if (window._eprocPararLote) throw new Error('PARADA_SOLICITADA');



      // Configuração: Evento (Coluna F)

      const txtEvento = document.getElementById('txtEvento');

      if (txtEvento) {

        destacarCampoAtivo(txtEvento, 'Evento', `${item.evento} ${item.eventoCod ? '(' + item.eventoCod + ')' : ''}`);

      }

      await selecionarEvento(item.evento, item.eventoCod);

      if (window._eprocPararLote) throw new Error('PARADA_SOLICITADA');

      await sleep(250);

      // Se o item NÃO prevê dados complementares, limpa imediatamente caso o AJAX do evento tenha trazido dados antigos
      if (!item.dadosComplementaresPares || item.dadosComplementaresPares.length === 0) {

        limparDadosComplementares();

      }



      // Configuração: Eventos Complementares (se houver na planilha ou inferidos)

      if (item.eventosComplementares && item.eventosComplementares.length > 0) {

        await selecionarEventosComplementares(item.eventosComplementares, dados);

        if (window._eprocPararLote) throw new Error('PARADA_SOLICITADA');

        await sleep(250);

      } else {

        limparEventosComplementares();

      }



      // Configuração: Agendamento de alteração dos dados do processo (Dado Complementar)

      if (item.dadosComplementaresPares && item.dadosComplementaresPares.length > 0) {

        await configurarDadosComplementares(item.dadosComplementaresPares, dados);

        if (window._eprocPararLote) throw new Error('PARADA_SOLICITADA');

        await sleep(250);

      } else {

        await resetarDadosComplementaresNoSubframe();

        if (window._eprocPararLote) throw new Error('PARADA_SOLICITADA');

        await sleep(200);

      }



      // Configuração: Comportamento do localizador: NÃO remover de localizador algum (valor 3)

      // [v3.5.6] Configuração: Comportamento do Localizador (0 = Remover informado(s)) e Localizadores a Desativar
      const selNovoLoc = document.getElementById('selNovoLocalizador');
      const selOpcaoLoc = document.getElementById('selOpcaoLocalizador');
      const selDesativar = document.getElementById('selLocalizadorDesativar');
      const codComportamento = (item.localizadoresDesativar && item.localizadoresDesativar.length > 0) ? '0' : (item.comportamentoLocalizador || '3');
      const arrIdsDesativarMinuta = [];
      if (selOpcaoLoc) {
        let textoComp = 'NÃO remover de localizador algum (3)';
        if (codComportamento === '0') textoComp = 'Remover o processo do(s) localizador(es) informado(s) (0)';
        else if (codComportamento === '1') textoComp = 'Remover de todos os localizadores atuais (1)';
        destacarCampoAtivo(selOpcaoLoc, 'Comportamento do Localizador', textoComp);
        selOpcaoLoc.value = codComportamento;
        dispararEventos(selOpcaoLoc, ['change']);
        if (typeof window.comportamentoLocalizadores === 'function') {
          try { window.comportamentoLocalizadores(''); } catch (e) {}
        }
        await sleep(200);
        dados.comportamento = textoComp;
      }
      if (codComportamento === '0' && item.localizadoresDesativar && item.localizadoresDesativar.length > 0) {
        if (selDesativar) {
          try {
            const divDes = document.getElementById('divLocalizadorDesativar') || selDesativar.parentElement;
            if (divDes) divDes.style.display = 'block';
          } catch (e) {}
          Array.from(selDesativar.options).forEach(o => { o.selected = false; o.removeAttribute('selected'); });
          const catalogoUnidade = await obterOuCarregarCatalogoLocalizadoresUnidade();
          const desativadosNomes = [];
          for (const alvo of item.localizadoresDesativar) {
            let optD = acharOpcaoLocalizador(selDesativar, alvo, false);
            if (!optD) {
              let idEncontrado = null;
              let textoEncontrado = alvo;
              if (Array.isArray(catalogoUnidade)) {
                const alvoNorm = normalizar(alvo);
                const itemCat = catalogoUnidade.find(l => {
                  const lNorm = normalizar(l.text || l.label || '');
                  return lNorm === alvoNorm || lNorm.includes(alvoNorm) || alvoNorm.includes(lNorm);
                });
                if (itemCat) {
                  idEncontrado = String(itemCat.value || itemCat.IdLocalizadorOrgao || itemCat.id || '').trim();
                  textoEncontrado = itemCat.text || itemCat.label || alvo;
                }
              }
              if (!idEncontrado && selNovoLoc) {
                const optRef = acharOpcaoLocalizador(selNovoLoc, alvo, false);
                if (optRef && optRef.value && optRef.value !== 'null') {
                  idEncontrado = optRef.value;
                  textoEncontrado = optRef.text;
                }
              }
              if (idEncontrado) {
                optD = document.createElement('option');
                optD.value = idEncontrado;
                optD.text = textoEncontrado;
                selDesativar.appendChild(optD);
              }
            }
            if (optD && optD.value) {
              optD.selected = true;
              optD.setAttribute('selected', 'selected');
              arrIdsDesativarMinuta.push(String(optD.value).trim());
              desativadosNomes.push(optD.text.trim());
            } else {
              addLog(`⚠️ Localizador a remover não localizado no catálogo da Unidade: "${alvo}"`, 'warn');
            }
          }
          if (window.$) {
            try {
              window.$('#selLocalizadorDesativar').val(arrIdsDesativarMinuta).trigger('change');
            } catch (e) {}
          }
          if (typeof window.salvaLocalizadoresMarcados === 'function') {
            try { window.salvaLocalizadoresMarcados('', ''); } catch (e) {}
          }
          dados.locDesativar = desativadosNomes.length > 0 ? desativadosNomes.join('; ') : '(Nenhum encontrado)';
          addLog(`🗑️ Localizador(es) a desativar marcado(s): ${dados.locDesativar} (IDs: ${arrIdsDesativarMinuta.join(', ')})`, 'info');
        }
      } else {
        if (selDesativar) {
          Array.from(selDesativar.options).forEach(o => { o.selected = false; o.removeAttribute('selected'); });
          if (window.$) {
            try { window.$('#selLocalizadorDesativar option').prop('selected', false); } catch (e) {}
          }
        }
        dados.locDesativar = codComportamento === '1' ? 'Remover de todos os localizadores atuais (1)' : '(Nenhum - NÃO remover de localizador algum)';
      }
      window._eprocMinutaLocsDesativar = arrIdsDesativarMinuta;
      window._eprocMinutaComportamentoLoc = codComportamento;


      // Configuração: Novo localizador (com regras de fallback estritas)


      let achouPrincipal = false;



      if (selNovoLoc) {

        destacarCampoAtivo(selNovoLoc, 'Localizador Principal', (item.localizadores && item.localizadores.length > 0) ? item.localizadores[0] : 'ARQUIVO - ARQUIVO');

        const primDesejado = (item.localizadores && item.localizadores.length > 0) ? item.localizadores[0] : '';

        if (primDesejado) {

          const optP = acharOpcaoLocalizador(selNovoLoc, primDesejado);

          if (optP) {

            selNovoLoc.value = optP.value;

            achouPrincipal = true;

            dados.locPrincipal = optP.text.trim();

          }

        }



        // REGRA DE FALLBACK: Se não encontrou o localizador da planilha (considerando emojis), usa "ARQUIVO - ARQUIVO"

        if (!achouPrincipal) {

          const optA = acharOpcaoLocalizador(selNovoLoc, 'ARQUIVO - ARQUIVO', true);

          if (optA) selNovoLoc.value = optA.value;

          dados.locPrincipal = `⚠️ "ARQUIVO - ARQUIVO" (Fallback: "${primDesejado}" não encontrado na Unidade)`;

          dados.locPrincipalFallback = true;

        }



        destacarCampoAtivo(selNovoLoc, 'Localizador Principal Definido', dados.locPrincipal);

        dispararEventos(selNovoLoc, ['change']);

        if (typeof window.marcarLocalizadorPrincipal === 'function') {

          try { window.marcarLocalizadorPrincipal(selNovoLoc); } catch (e) {}

        }

        if (typeof window.habilitarLocalizadoresSecundarios === 'function') {

          try { window.habilitarLocalizadoresSecundarios(selNovoLoc); } catch (e) {}

        }

        await sleep(250);

      }



      // Trata campo secundário: "Incluir processo em outros localizadores"

      const chkSec = document.getElementById('chkLocalizadoresSecundarios');

      const selSec = document.getElementById('selLocalizadorSecundario');

      if (chkSec && selSec) {

        destacarCampoAtivo(selSec || chkSec, 'Localizadores Secundários', (item.localizadores && item.localizadores.length > 1) ? item.localizadores.slice(1).join('; ') : '(Nenhum)');

      }



      if (chkSec && selSec) {

        function resetarSecundarios() {

          Array.from(selSec.options).forEach(opt => opt.selected = false);

          if (window.jQuery && window.jQuery(selSec).multipleSelect) {

            try {

              window.jQuery(selSec).multipleSelect('uncheckAll');

              window.jQuery(selSec).multipleSelect('setSelects', []);

              window.jQuery(selSec).multipleSelect('refresh');

            } catch (e) {}

          }

          const drop = document.getElementById('ms-drop-selLocalizadorSecundario');

          if (drop) {

            drop.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = false);

          }

          dispararEventos(selSec, ['change']);

        }



        resetarSecundarios();

        await sleep(100);



        if (!achouPrincipal) {

          chkSec.disabled = false;

          chkSec.checked = true;

          dispararEventos(chkSec, ['change', 'click']);

          if (typeof window.chkLocalizadoresSecundariosOnClick === 'function') {

            try { window.chkLocalizadoresSecundariosOnClick(chkSec); } catch (e) {}

          }

          await sleep(200);



          const optB = acharOpcaoLocalizador(selSec, 'BAIXADOS - BAIXADOS', true);

          if (optB && optB.value) {

            optB.selected = true;

            if (window.jQuery && window.jQuery(selSec).multipleSelect) {

              try {

                window.jQuery(selSec).multipleSelect('setSelects', [optB.value]);

                window.jQuery(selSec).multipleSelect('refresh');

              } catch (e) {}

            }

          }

          dados.locSecundarios = ['⚠️ "BAIXADOS - BAIXADOS" (Fallback: Localizador principal inexistente)'];

          dados.locSecundariosFallback = true;

          dispararEventos(selSec, ['change']);

        } else if (item.localizadores && item.localizadores.length > 1) {

          chkSec.disabled = false;

          chkSec.checked = true;

          dispararEventos(chkSec, ['change', 'click']);

          if (typeof window.chkLocalizadoresSecundariosOnClick === 'function') {

            try { window.chkLocalizadoresSecundariosOnClick(chkSec); } catch (e) {}

          }

          await sleep(200);



          let achouAlgumSec = false;

          const valoresSelecionar = [];

          const nomesSecEncontrados = [];



          item.localizadores.slice(1).forEach(desejado => {

            const o = acharOpcaoLocalizador(selSec, desejado);

            if (o && o.value && o.value !== 'null') {

              o.selected = true;

              valoresSelecionar.push(o.value);

              nomesSecEncontrados.push(o.text.trim());

              achouAlgumSec = true;

            }

          });



          if (!achouAlgumSec) {

            const optB2 = acharOpcaoLocalizador(selSec, 'BAIXADOS - BAIXADOS', true);

            if (optB2 && optB2.value) {

              optB2.selected = true;

              valoresSelecionar.push(optB2.value);

            }

            dados.locSecundarios = ['⚠️ "BAIXADOS - BAIXADOS" (Fallback: Secundários não encontrados na Unidade)'];

            dados.locSecundariosFallback = true;

          } else {

            dados.locSecundarios = nomesSecEncontrados;

          }



          if (window.jQuery && window.jQuery(selSec).multipleSelect) {

            try {

              window.jQuery(selSec).multipleSelect('setSelects', valoresSelecionar);

              window.jQuery(selSec).multipleSelect('refresh');

            } catch (e) {}

          }

          dispararEventos(selSec, ['change']);

        } else {

          chkSec.checked = false;

          dispararEventos(chkSec, ['change', 'click']);

          if (typeof window.chkLocalizadoresSecundariosOnClick === 'function') {

            try { window.chkLocalizadoresSecundariosOnClick(chkSec); } catch (e) {}

          }

          resetarSecundarios();

          dados.locSecundarios = ['(Nenhum)'];

        }

      }



      // Configuração: Classificação (suporte a múltiplas classificações separadas por ';')
      const elClassif = document.getElementById('selClassificacaoConteudo') || document.getElementById('selClassificacaoConteudoIds');
      const rawClassifDesejada = (item.classificacao || '').trim();
      let objsClassif = [];
      let nomesClassifNaoCadastradas = [];

      if (rawClassifDesejada && rawClassifDesejada !== '-') {
        const partesClassif = rawClassifDesejada.split(';')
          .map(s => s.trim())
          .filter(s => s && s !== '-');

        destacarCampoAtivo(elClassif, 'Classificação', partesClassif.join('; '));

        for (const nomeC of partesClassif) {
          const res = await resolverIdClassificacao(nomeC);
          if (res && /^\d+$/.test(String(res.id).trim())) {
            objsClassif.push(res);
          } else {
            nomesClassifNaoCadastradas.push(nomeC);
          }
        }

        if (objsClassif.length > 0) {
          aplicarClassificacaoNaTela(objsClassif);
          dados.classificacao = objsClassif.map(c => c.text).join('; ');
          addLog(`✓ Classificação aplicada: ${dados.classificacao}`);
          if (nomesClassifNaoCadastradas.length > 0) {
            addLog(`⚠️ Classificações não localizadas/criadas: "${nomesClassifNaoCadastradas.join('; ')}"`, 'warn');
          }
        } else {
          // SEGURANÇA TOTAL: NUNCA aplica texto não-numérico para não corromper a preferência
          aplicarClassificacaoNaTela(null);
          dados.classificacao = `⚠️ Em branco ("${rawClassifDesejada}" não cadastrada no eproc)`;
          addLog(`⚠️ Nenhuma das classificações ("${rawClassifDesejada}") pôde ser cadastrada/localizada. Campo mantido vazio para 100% de segurança.`, 'warn');
        }
      } else {
        aplicarClassificacaoNaTela(null);
        dados.classificacao = '(Em branco)';
      }



      // REGRA MANDADO CEMAN + AUDIÊNCIA: Configura Urgência como "Prioridade Audiência"

      const nomeModAlvo = normalizar((item.modelo || '') + ' ' + (item.nome || ''));

      const txtModVal = normalizar(document.getElementById('txtModelo')?.value || '');

      const ehMandadoCeman = (nomeModAlvo.includes('mandado') && nomeModAlvo.includes('ceman')) ||

                             (txtModVal.includes('mandado') && txtModVal.includes('ceman'));



      const ehClassifAudiencia = normalizar(item.classificacao || '').includes('audiencia');



      if (ehMandadoCeman && ehClassifAudiencia) {

        let selUrgencia = document.getElementById('selTipoUrgencia');

        let aguardouUrg = 0;

        while (!selUrgencia && aguardouUrg < 2500) {

          await sleep(150);

          aguardouUrg += 150;

          selUrgencia = document.getElementById('selTipoUrgencia');

        }



        if (selUrgencia) {

          destacarCampoAtivo(selUrgencia, 'Dados do Mandado', 'Prioridade Audiência');

          const optAudiencia = Array.from(selUrgencia.options).find(o => normalizar(o.textContent).includes('prioridade audiencia'));

          if (optAudiencia) {

            selUrgencia.value = optAudiencia.value;

            selUrgencia.selectedIndex = optAudiencia.index;

            dispararEventos(selUrgencia, ['change']);

            if (typeof window.controlarMandadoDataUrgencia === 'function') {

              try { window.controlarMandadoDataUrgencia(); } catch (e) {}

            }

            dados.urgenciaMandado = 'Prioridade Audiência';

            addLog('✓ Mandado CEMAN: Urgência configurada como "Prioridade Audiência"');

            await sleep(200);

          }

        }

      }



      // Configuração: Descrição

      const elDesc = document.getElementById('txtDescricao');

      if (elDesc) {

        destacarCampoAtivo(elDesc, 'Descrição da Minuta', item.descricao || '(Sem observação)');

        elDesc.value = item.descricao || '';

        dispararEventos(elDesc, ['input', 'change']);

      }



      // Configuração: Assinante (coluna "Assinante Indicado" da planilha)

      const selAssinante = document.getElementById('selAssinante');

      if (selAssinante) {

        const indicado = (item.assinanteIndicado || '').trim();

        const achar = () => {

          const opts = Array.from(selAssinante.options);

          if (indicado && indicado !== '-') {

            const nI = normalizar(indicado);

            const o = opts.find(x => normalizar(x.text) === nI) || opts.find(x => nI.length > 3 && normalizar(x.text).includes(nI));

            if (o) return o;

            if (nI.includes('magistrado')) {

              return opts.find(x => /magistrado|desembargador|relator|juiz/.test(normalizar(x.text)) && !/selecione/.test(normalizar(x.text))) || null;

            }

            return null;

          }

          return null;

        };

        let optAss = null;

        if (indicado && indicado !== '-') {

          for (let t = 0; t < 30 && !optAss; t++) { optAss = achar(); if (!optAss) await sleep(150); }

          if (!optAss) {

            addLog('⚠️ Assinante "' + indicado + '" indisponível para este modelo. Opções: ' + Array.from(selAssinante.options).map(o => o.text.trim()).slice(0, 10).join(' | '), 'warn');

          }

        }

        if (optAss) {

          destacarCampoAtivo(selAssinante, 'Assinante', optAss.text.trim());

          selAssinante.value = optAss.value;

          if (window.jQuery) window.jQuery(selAssinante).val(optAss.value).trigger('change'); else dispararEventos(selAssinante, ['change']);

          dados.assinante = optAss.text.trim();

        } else {

          dados.assinante = (selAssinante.options[selAssinante.selectedIndex] || {}).text || '(padrão)';

        }

        await sleep(200);

      }



      // Configuração: Status destino: Para assinar (valor "4")

      const selStatus = document.getElementById('selStatusMinuta');

      if (selStatus) {

        destacarCampoAtivo(selStatus, 'Status Destino', 'Para assinar (4)');

        selStatus.value = '4';

        dispararEventos(selStatus, ['change']);

        await sleep(200);

      }



      if (window._eprocPararLote) throw new Error('PARADA_SOLICITADA');



      // Configuração 2G: Agendar Intimação das Partes

      window._eprocItemAtual = item;

      window._eprocEventoIntimacaoId = null;

      window._eprocEventoRemessaId = null;

      window._eprocOrgaoRemessaId = null;

      window._eprocGrupoAtualId = null;



      if (item.intimarPartes) {

        await configurarIntimacaoPartes2G(item, dados);

        if (window._eprocPararLote) throw new Error('PARADA_SOLICITADA');

        await sleep(250);

      } else {

        await desativarIntimacaoPartes2G();

      }



      // Configuração 2G: Remeter Processo

      if (item.remeterProcesso) {

        await configurarRemessaProcesso2G(item, dados);

        if (window._eprocPararLote) throw new Error('PARADA_SOLICITADA');

        await sleep(250);

      } else {

        await desativarRemessaProcesso2G();

      }



      // Configuração 2G: Grupo de Preferências (Fluxo)

      if (item.grupo && item.grupo !== '-') {

        const objGrp = await gerenciarGrupoPreferencia2G(item.grupo);

        if (objGrp) {

          dados.grupo = objGrp.text;

        }

        await sleep(200);

      }



      // GARANTIA TOTAL DA CLASSIFICAÇÃO: Reafirma valor no input e ativa hook de salvamento
      instalarHookGravarPreferencias();

      if (Array.isArray(objsClassif) && objsClassif.length > 0) {
        const inpCl = document.getElementById('selClassificacaoConteudo');
        const idsJoined = objsClassif.map(c => String(c.id).trim()).filter(id => /^\d+$/.test(id)).join(',');
        if (inpCl && idsJoined) {
          inpCl.value = idsJoined;
          inpCl.setAttribute('value', idsJoined);
        }
      }



      // GARANTIA DOS DADOS COMPLEMENTARES: Se foram solicitados dados complementares, verifica se hdnDadosComplementares está preenchido

      if (item.dadosComplementaresPares && item.dadosComplementaresPares.length > 0) {

        const hdnCheck = document.getElementById('hdnDadosComplementares');

        const descCheck = document.getElementById('descDadosComplementares');

        const hVal = (hdnCheck ? hdnCheck.value : '').trim();

        const dVal = (descCheck ? descCheck.textContent : '').trim();

        if (hVal || dVal) {

          addLog(`✅ Confirmação: Dados complementares ativos para a preferência (${dVal || hVal})`);

        } else {

          addLog(`⚠️ Aviso: hdnDadosComplementares não preenchido antes da gravação da preferência.`, 'warn');

        }

      } else {

        // Se este item NÃO possui dados complementares, reforça que os campos e variáveis estejam vazios
        limparDadosComplementares();

      }



      await garantirAgendamentos2G(item, dados);



      // GARANTE RADIO UNIDADE E SELECT GRUPO HABILITADO ANTES DO SALVAMENTO

      const rdUnidadeFinal = document.querySelector('input[name="rdPrefTipo"][value="U"]');

      if (rdUnidadeFinal) {

        rdUnidadeFinal.checked = true;

        dispararEventos(rdUnidadeFinal, ['change', 'click']);

      }

      const selGrupoFinal = document.getElementById('selFormularioPersonalizacaoGrupo');

      if (selGrupoFinal) {

        selGrupoFinal.disabled = false;

        if (window.$) $(selGrupoFinal).prop('disabled', false);

        if (window._eprocGrupoAtualId) {

          selGrupoFinal.value = window._eprocGrupoAtualId;

          const optMatch = Array.from(selGrupoFinal.options).find(o => o.value === window._eprocGrupoAtualId);

          if (optMatch) optMatch.selected = true;

        }

      }

      await sleep(200);



      // REAFIRMA "Localizadores selecionados" (o eproc pode ter trocado para Desmarcar/Marcar todos)

      for (let k = 0; k < 4; k++) {

        const rdI = document.getElementById('rdIndividuais');

        if (!rdI) break;

        rdI.disabled = false;

        if (!rdI.checked) { rdI.click(); await sleep(150); }

        if (!rdI.checked) { rdI.checked = true; dispararEventos(rdI, ['change']); }

        await sleep(200);

        const cur = document.querySelector('input[name="rdPrefLocalizadores"]:checked');

        if (cur && cur.value === 'L') break;

      }



      // GRAVAÇÃO DA PREFERÊNCIA: Aciona validação e salvamento


      // [v3.5.6] Reafirmação estrita do comportamento e localizadores a desativar antes de validar
      if (window._eprocMinutaComportamentoLoc) {
        const selOpRef = document.getElementById('selOpcaoLocalizador');
        if (selOpRef) {
          selOpRef.value = window._eprocMinutaComportamentoLoc;
          dispararEventos(selOpRef, ['change']);
        }
      }
      if (Array.isArray(window._eprocMinutaLocsDesativar) && window._eprocMinutaLocsDesativar.length > 0) {
        const selDesRef = document.getElementById('selLocalizadorDesativar');
        if (selDesRef) {
          selDesRef.disabled = false;
          Array.from(selDesRef.options).forEach(o => {
            if (window._eprocMinutaLocsDesativar.includes(String(o.value).trim())) {
              o.selected = true;
              o.setAttribute('selected', 'selected');
            }
          });
          if (window.$) {
            try { window.$('#selLocalizadorDesativar').val(window._eprocMinutaLocsDesativar).trigger('change'); } catch (e) {}
          }
          if (typeof window.salvaLocalizadoresMarcados === 'function') {
            try { window.salvaLocalizadoresMarcados('', ''); } catch (e) {}
          }
        }
      }
      await sleep(150);

      const btnOK = document.getElementById('btnOK');

      if (btnOK) {

        destacarCampoAtivo(btnOK, 'Salvar Preferência', `Gravando: ${item.nome}`);

        dispararClique(btnOK);

      } else if (typeof window.validarPreferencias === 'function') {

        window.validarPreferencias();

      }



      // Aguarda resposta da gravação AJAX (até 5s)

      let aguardou = 0;

      while (aguardou < 5000) {

        if (window._eprocPararLote) break;

        await sleep(250);

        aguardou += 250;

        if (ultimoAvisoEproc) {

          const avisoNorm = ultimoAvisoEproc.toLowerCase();

          if (avisoNorm.includes('cadastrada') || avisoNorm.includes('atualizada') || avisoNorm.includes('sucesso')) {

            break;

          }

          if (avisoNorm.includes('erro') || avisoNorm.includes('já existe') || avisoNorm.includes('ja existe') || avisoNorm.includes('mesma descrição') || avisoNorm.includes('mesma descricao')) {

            break;

          }

        }

        if (btnOK && !btnOK.disabled && aguardou > 1200) {

          break;

        }

      }



      if (ultimoAvisoEproc) {

        const avisoNorm = ultimoAvisoEproc.toLowerCase();

        if (avisoNorm.includes('já existe') || avisoNorm.includes('ja existe') || avisoNorm.includes('mesma descrição') || avisoNorm.includes('mesma descricao')) {

          throw new Error('DUPLICADA: ' + ultimoAvisoEproc);

        }

        if (avisoNorm.includes('erro') || avisoNorm.includes('falha') || avisoNorm.includes('não foi possível')) {

          throw new Error(ultimoAvisoEproc);

        }

      }



      dados.sucesso = true;

      return dados;

    } finally {

      removerDestaqueCampo();

      limparDadosComplementares();

      gravacaoEmAndamento = false;

    }

  }



  /* ================== PERSISTÊNCIA DE LOGS (RESISTE AO F5) ================== */

  const SESSION_KEY_LOGS = 'eproc_pref_logs_history_v83';



  function salvarLogsNoStorage() {

    try {

      const box = document.getElementById('rito-logs');

      if (box && box.innerHTML && box.textContent.trim() !== 'Aguardando planilha...') {

        sessionStorage.setItem(SESSION_KEY_LOGS, box.innerHTML);

      }

    } catch (e) {}

  }



  /* ================== RESTAURAÇÃO DA TELA INICIAL "NOVA MINUTA" ================== */

  function destravarTelaEproc() {

    try { if (typeof window.infraOcultarAviso === 'function') window.infraOcultarAviso(); } catch (e) {}

    try {

      const fundo = document.getElementById('divInfraAvisoFundo'); if (fundo) fundo.remove();

      ['divInfraAviso', 'aguardando'].forEach(id => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });

      const b = document.getElementById('btnOK'); if (b) b.disabled = false;

      document.body.style.overflow = ''; document.documentElement.style.overflow = ''; document.body.style.pointerEvents = '';

      fecharSubframeSeAberto();

    } catch (e) {}

  }



  async function restaurarTelaInicialEproc() {

    try {

      removerDestaqueCampo();



      // 1. Cancela/fecha subformulário de opções de preferência (#divPrefOpcoes)

      const btnCancelar = document.getElementById('btnCancelarPreferencias');

      if (btnCancelar) {

        try { dispararClique(btnCancelar); } catch (e) {}

      }



      if (typeof window.limparCpsFormPref === 'function') {

        try { window.limparCpsFormPref(); } catch (e) {}

      }

      if (typeof window.exibeOcultaItens === 'function') {

        try { window.exibeOcultaItens(true); } catch (e) {}

      }



      // 2. Restaura visibilidade de todas as barras nativas e botões que o eproc oculta

      const divs = document.querySelectorAll('#divSelecaoPreferencia, #divInfraBarraComandosSuperior, #divInfraBarraComandosInferior');

      divs.forEach(d => { if (d) d.style.display = 'block'; });



      const divOpcoes = document.getElementById('divPrefOpcoes');

      if (divOpcoes) divOpcoes.style.display = 'none';



      const botoes = document.querySelectorAll('#btnSalvarPreferencias, #btnAtualizarPreferencias, #lblListarPreferencia');

      botoes.forEach(b => { if (b) b.style.display = ''; });



      // 3. Limpeza completa dos campos do formulário conforme a tela ativa
      if (ehTelaDeMovimentacao()) {
        resetarFormularioMovimentacao();
      } else if (ehTelaDeIntimacao()) {
        resetarFormularioIntimacao();
      } else if (ehTelaDeMinuta()) {
        resetarFormularioCompletamente();
        aplicarClassificacaoNaTela(null);
      }

      // 4. Rola suavemente para o topo da tela
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch (err) {
      console.warn('Erro ao restaurar tela inicial do eproc:', err);
    }
    destravarTelaEproc();
    setTimeout(destravarTelaEproc, 1500);
    setTimeout(destravarTelaEproc, 4000);
  }

    /* ================== HOOK DE SEGURANÇA EM GRAVAR PREFERÊNCIAS ================== */
  function instalarHookGravarPreferencias() {
    if (typeof window.atualizaComboPreferencias === 'function' && !window._atualizaComboPreferenciasOriginal) {
      window._atualizaComboPreferenciasOriginal = window.atualizaComboPreferencias;
      window.atualizaComboPreferencias = function () {
        if (execucaoLoteAtiva || gravacaoEmAndamento) return;
        return window._atualizaComboPreferenciasOriginal.apply(this, arguments);
      };
    }
    if (typeof window.gravarPreferencias === 'function' && !window._gravarPreferenciasOriginal) {

      window._gravarPreferenciasOriginal = window.gravarPreferencias;

      window.gravarPreferencias = function (listaDados) {

        try {

          if (typeof listaDados === 'string') {

            let partes = listaDados.split(',');



            // 1. Classificação (suporte a múltiplas classificações)
            const classifsAtuais = Array.isArray(window._eprocClassificacaoAtual)
              ? window._eprocClassificacaoAtual
              : (window._eprocClassificacaoAtual && /^\d+$/.test(window._eprocClassificacaoAtual.id) ? [window._eprocClassificacaoAtual] : []);

            if (classifsAtuais.length > 0) {
              partes = partes.filter(p => !p.startsWith('IdClassificacao|'));
              classifsAtuais.forEach(c => {
                if (c && c.id && /^\d+$/.test(String(c.id).trim())) {
                  partes.push('IdClassificacao|' + String(c.id).trim());
                }
              });
            }



            // 2. Eventos complementares dentro do payload de agendamento

            if (Array.isArray(window._eprocEventosCompAtuais) && window._eprocEventosCompAtuais.length > 0) {

              partes = partes.map(parte => {

                const prefixo = ['Agendamento|', 'frmDadosMinutaParaATP|'].find(p => parte.startsWith(p));

                if (!prefixo) return parte;

                try {

                  const pares = atob(parte.substring(prefixo.length)).split('&').filter(par => !decodeURIComponent(par.split('=')[0]).startsWith('selEventoComplementar'));

                  for (const val of window._eprocEventosCompAtuais) pares.push('selEventoComplementar%5B%5D=' + encodeURIComponent(val));

                  return prefixo + btoa(pares.join('&'));

                } catch (e) { return parte; }

              });

            }



            // 3. Sanitização de Dados Complementares, Intimação e Remessa no payload (preservando codificação original do serialize)

            if (window._eprocItemAtual) {

              const semDadosComp = !window._eprocItemAtual.dadosComplementaresPares || window._eprocItemAtual.dadosComplementaresPares.length === 0;

              const semIntimacao = !window._eprocItemAtual.intimarPartes;

              const semRemessa = !window._eprocItemAtual.remeterProcesso;



              if (semIntimacao) {

                partes = partes.map(p => p.startsWith('chkEncadeamentoIntimar|') ? 'chkEncadeamentoIntimar|N' : p);

              }

              if (semRemessa) {

                partes = partes.map(p => p.startsWith('chkEncadeamentoRemessa|') ? 'chkEncadeamentoRemessa|N' : p);

              }



              partes = partes.map(parte => {

                const prefixo = ['Agendamento|', 'frmDadosMinutaParaATP|'].find(p => parte.startsWith(p));

                if (!prefixo) return parte;

                try {

                  const rawPares = atob(parte.substring(prefixo.length)).split('&');

                  const novosPares = [];

                  for (const par of rawPares) {

                    const eqIdx = par.indexOf('=');

                    const kRaw = eqIdx !== -1 ? par.substring(0, eqIdx) : par;

                    let k = kRaw;

                    try { k = decodeURIComponent(kRaw); } catch (e) {}

                    if (semDadosComp) {

                      if (k === 'hdnDadosComplementares' || k === 'hdnDadosAutuacao') {

                        novosPares.push(kRaw + '=');

                        continue;

                      }

                      if (k.startsWith('selDadoComplementar')) continue;

                    }

                    if (semIntimacao && k === 'chkEncadeamentoIntimar') continue;

                    if (semRemessa && k === 'chkEncadeamentoRemessa') continue;

                    novosPares.push(par);

                  }

                  return prefixo + btoa(novosPares.join('&'));

                } catch (e) {

                  return parte;

                }

              });

            }



            // Diagnóstico: o que realmente será gravado

            const temInt = partes.some(p => p.startsWith('chkEncadeamentoIntimar|S'));

            const temRem = partes.some(p => p.startsWith('chkEncadeamentoRemessa|S'));

            try {

              const rdLoc = document.querySelector('input[name="rdPrefLocalizadores"]:checked');

              addLog('📤 Gravando: intimação=' + (temInt ? 'SIM' : 'não') + ', remessa=' + (temRem ? 'SIM' : 'não') + ', localizadores=' + (rdLoc ? rdLoc.value : '?'));

              const ag = partes.find(p => p.startsWith('Agendamento|'));

              if (ag) {

                const q = new URLSearchParams(atob(ag.substring(12)));

                const ks = ['chkEncadeamentoIntimar', 'selEventoEncadeadoCitacaoIntimacao', 'txtPrazoEntPrazoEspecial', 'chkEncadeamentoRemessa', 'selEventoEncadeadoRemessa', 'selOrgao'];

                addLog('🧾 Payload agendamento: ' + ks.map(k => k + '=' + (q.get(k) === null ? '∅' : q.get(k))).join(', ') + ' | partes marcadas=' + Array.from(q.keys()).filter(k => k.startsWith('chkParte')).length + ' | compl=' + q.getAll('selEventoComplementar[]').join(';'));

              }

            } catch (e) {}



            // 4. [v3.5.5] Garantia absoluta de payload para o Módulo de Intimações
            if (window._eprocItemIntimacaoAtual && window._eprocItemIntimacaoAtual.item) {
              const ctxInt = window._eprocItemIntimacaoAtual;
              const itInt = ctxInt.item;
              const setChave = (chave, valor) => {
                const prefixo = chave + '|';
                const idx = partes.findIndex(p => p.startsWith(prefixo));
                if (idx !== -1) {
                  partes[idx] = prefixo + valor;
                } else {
                  partes.push(prefixo + valor);
                }
              };

              if (ctxInt.idEventoSelecionado) {
                setChave('IdEventoJudicial', ctxInt.idEventoSelecionado);
              }

              // Garante sinLocalizadores = 'L' (Localizadores selecionados)
              setChave('sinLocalizadores', ctxInt.sinLocalizadores || 'L');

              // Garante IdNovoLocalizador
              if (ctxInt.idNovoLocalizadorSelecionado && ctxInt.idNovoLocalizadorSelecionado !== 'null') {
                setChave('IdNovoLocalizador', ctxInt.idNovoLocalizadorSelecionado);
              } else {
                setChave('IdNovoLocalizador', '');
              }

              // Garante NumIdLocalizadorDesativar para todos os localizadores a remover
              partes = partes.filter(p => !p.startsWith('NumIdLocalizadorDesativar'));
              if (Array.isArray(ctxInt.arrIdsDesativar) && ctxInt.arrIdsDesativar.length > 0) {
                ctxInt.arrIdsDesativar.forEach((idDes, idx) => {
                  partes.push('NumIdLocalizadorDesativar' + idx + '|' + idDes);
                });
              }
              if (ctxInt.modoPolo) {
                setChave('opcoes_avancadas', 'porPolo');
                if (itInt.prazoMP && itInt.prazoMP !== '-') {
                  setChave('chkSelMPF', 'S');
                  setChave('txtPrazoMPF', String(itInt.prazoMP).trim());
                }
                if (itInt.prazoAutores && itInt.prazoAutores !== '-') {
                  setChave('chkSelPrazoAutores', 'S');
                  setChave('txtPrazoAutores', String(itInt.prazoAutores).trim());
                }
                if (itInt.prazoReus && itInt.prazoReus !== '-') {
                  setChave('chkSelPrazoReus', 'S');
                  setChave('txtPrazoReus', String(itInt.prazoReus).trim());
                }
                if (itInt.prazoInteressados && itInt.prazoInteressados !== '-') {
                  setChave('chkSelPrazoInteressados', 'S');
                  setChave('txtPrazoInteressados', String(itInt.prazoInteressados).trim());
                }
              } else if (ctxInt.modoTipoParte) {
                setChave('opcoes_avancadas', 'porTipoDeParte');
                if (itInt.prazoEspEnt && itInt.prazoEspEnt !== '-') {
                  setChave('chkSelEntPrazoEspecial', 'S');
                  setChave('txtPrazoEntPrazoEspecial', String(itInt.prazoEspEnt).trim());
                }
                if (itInt.prazoSimpEnt && itInt.prazoSimpEnt !== '-') {
                  setChave('chkSelEntPrazoSimples', 'S');
                  setChave('txtPrazoEntPrazoSimples', String(itInt.prazoSimpEnt).trim());
                }
                if (itInt.prazoSimpDemais && itInt.prazoSimpDemais !== '-') {
                  setChave('chkSelNaoEntPrazoSimples', 'S');
                  setChave('txtPrazoNaoEntPrazoSimples', String(itInt.prazoSimpDemais).trim());
                }
                if (itInt.prazoDPU && itInt.prazoDPU !== '-') {
                  setChave('chkSelDPU', 'S');
                  setChave('txtPrazoDPU', String(itInt.prazoDPU).trim());
                }
              }
              setChave('txtPrazoIgual', '');
              addLog(`📤 Payload Intimação confirmado: Evento=${ctxInt.idEventoSelecionado} | sinLoc=${ctxInt.sinLocalizadores || 'L'} | IdNovoLoc=${ctxInt.idNovoLocalizadorSelecionado || 'null'} | Desativar=[${(ctxInt.arrIdsDesativar || []).join(', ')}] | opcoes_avancadas=${ctxInt.modoPolo ? 'porPolo' : 'porTipoDeParte'} | MP=${itInt.prazoMP || '-'} dias`, 'info');
            }




            listaDados = partes.join(',');

          }

        } catch (e) {

          console.warn('Erro no hook de gravarPreferencias:', e);

        }

        return window._gravarPreferenciasOriginal.apply(this, [listaDados]);

      };

    }

  }



  /* ================== PAINEL FLUTUANTE (ESTILO RITO TJSP) ================== */

  function corInstancia() {

    const nav = document.querySelector('#navbar-accessibility, .bg-instancia, #divInfraBarraSistemaE, .infraBarraSistema');

    if (nav) {

      const bg = getComputedStyle(nav).backgroundColor;

      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;

    }

    return '#15803d';

  }



  function injetarEstilosPainel() {

    if (document.getElementById('rito-panel-styles')) return;

    const st = document.createElement('style');

    st.id = 'rito-panel-styles';

    st.textContent = `

      #rito-panel {

        position: fixed;

        bottom: 18px;

        right: 18px;

        z-index: 2147483647;

        background: #ffffff;

        border: 1px solid #cbd5e1;

        border-radius: 8px;

        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;

        font-size: 13px;

        line-height: 1.45;

        width: 440px;

        max-width: calc(100vw - 24px);

        box-shadow: 0 8px 30px rgba(15, 23, 42, 0.22);

        color: #1e293b;

        overflow: hidden;

        user-select: none;

      }

      #rito-panel-header {

        display: flex;

        align-items: center;

        justify-content: space-between;

        padding: 8px 12px;

        color: #ffffff;

        font-weight: 700;

        font-size: 13px;

        cursor: move;

        letter-spacing: 0.2px;

      }

      .rito-header-title {

        display: flex;

        align-items: center;

        gap: 6px;

        overflow: hidden;

        text-overflow: ellipsis;

        white-space: nowrap;

      }

      .rito-header-actions {

        display: flex;

        align-items: center;

        gap: 6px;

      }

      .rito-header-btn {

        background: transparent;

        border: none;

        color: #ffffff;

        border-radius: 3px;

        width: 22px;

        height: 20px;

        line-height: 18px;

        text-align: center;

        cursor: pointer;

        font-weight: bold;

        font-size: 13px;

        padding: 0;

        transition: background 0.15s;

      }

      .rito-header-btn:hover {

        background: rgba(255, 255, 255, 0.35);

      }

      #rito-panel-body {

        padding: 12px 14px;

        max-height: 540px;

        overflow-y: auto;

        background: #f8fafc;

        user-select: text;

      }

      #rito-panel.rito-minimized #rito-panel-body {

        display: none !important;

      }

      #rito-panel.rito-minimized {

        width: auto !important;

        min-width: 260px !important;

      }

      .rito-card {

        background: #ffffff;

        border: 1px solid #e2e8f0;

        border-radius: 6px;

        padding: 9px 12px;

        margin-bottom: 9px;

        box-shadow: 0 1px 3px rgba(0,0,0,0.03);

      }

      .rito-card-title {

        font-size: 11px;

        text-transform: uppercase;

        font-weight: 700;

        color: #64748b;

        margin-bottom: 3px;

      }

      .rito-card-value {

        font-size: 12.5px;

        font-weight: 600;

        color: #0f172a;

      }

      .rito-dropzone {

        border: 2px dashed #94a3b8;

        border-radius: 6px;

        padding: 12px;

        text-align: center;

        background: #ffffff;

        cursor: pointer;

        transition: all 0.2s;

        margin-bottom: 9px;

      }

      .rito-dropzone:hover {

        border-color: #0088cc;

        background: #f0fdf4;

      }

      .rito-btn {

        display: flex;

        align-items: center;

        justify-content: center;

        gap: 6px;

        width: 100%;

        padding: 8px 12px;

        font-size: 12.5px;

        font-weight: 600;

        border-radius: 4px;

        border: 1px solid transparent;

        cursor: pointer;

        color: #ffffff;

        transition: all 0.15s;

        margin-top: 6px;

      }

      .rito-btn-primary {

        background: #0077b6;

        border-color: #00669e;

      }

      .rito-btn-primary:hover {

        background: #005f92;

      }

      .rito-btn-danger {

        background: #b02a37;

        border-color: #90232d;

      }

      .rito-btn-danger:hover {

        background: #991b1b;

      }

      .rito-btn-secondary {

        background: #ffffff;

        border: 1px solid #ced4da;

        color: #0077b6;

      }

      .rito-btn-secondary:hover {

        background: #e9ecef;

      }

      .rito-module-tabs {
        display: flex;
        flex-direction: column;
        gap: 5px;
        background: #f1f5f9;
        padding: 6px;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        margin-bottom: 8px;
      }

      .rito-module-row-1 {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 5px;
      }

      .rito-module-row-2 {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 5px;
      }

      .rito-btn-modulo {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 7px 6px;
        border-radius: 6px;
        border: 1px solid #cbd5e1;
        background: #ffffff;
        color: #475569;
        font-size: 11.5px;
        font-weight: 700;
        line-height: 1.2;
        white-space: nowrap;
        cursor: pointer;
        transition: all 0.15s ease;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
      }

      .rito-btn-modulo:hover:not(.active) {
        background: #f8fafc;
        color: #15803d;
        border-color: #94a3b8;
      }

      .rito-btn-modulo.active {
        background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
        color: #ffffff;
        border-color: #14532d;
        box-shadow: 0 2px 6px rgba(21, 128, 61, 0.3);
      }

      .rito-btn-modulo svg {
        width: 15px;
        height: 15px;
        stroke: currentColor;
        fill: none;
        stroke-width: 2.2;
        stroke-linecap: round;
        stroke-linejoin: round;
        flex-shrink: 0;
      }



      @keyframes rito-stripes-move {

        0% { background-position: 0 0; }

        100% { background-position: 28px 0; }

      }

      @keyframes rito-spin {

        0% { transform: rotate(0deg); }

        100% { transform: rotate(360deg); }

      }

      .rito-progress-wrap {

        display: none;

        margin: 8px 0;

      }

      .rito-progress-bar {

        background: linear-gradient(90deg, #0088cc 0%, #16a34a 100%);

        height: 100%;

        width: 0%;

        transition: width 0.18s ease;

      }

      .rito-progress-bar.rito-progress-active {

        background-image: linear-gradient(

          45deg,

          rgba(255, 255, 255, 0.32) 25%,

          transparent 25%,

          transparent 50%,

          rgba(255, 255, 255, 0.32) 50%,

          rgba(255, 255, 255, 0.32) 75%,

          transparent 75%,

          transparent

        ), linear-gradient(90deg, #0284c7 0%, #0ea5e9 50%, #16a34a 100%);

        background-size: 28px 28px, 100% 100%;

        animation: rito-stripes-move 0.65s linear infinite;

        box-shadow: 0 0 8px rgba(14, 165, 233, 0.55);

      }

      .rito-spinner {

        display: inline-block;

        width: 11px;

        height: 11px;

        border: 2px solid #0284c7;

        border-top-color: transparent;

        border-radius: 50%;

        animation: rito-spin 0.7s linear infinite;

        vertical-align: -1.5px;

        margin-right: 5px;

      }

      .rito-spinner-light {

        display: inline-block;

        width: 12px;

        height: 12px;

        border: 2px solid rgba(255, 255, 255, 0.95);

        border-top-color: transparent;

        border-radius: 50%;

        animation: rito-spin 0.7s linear infinite;

        vertical-align: -2px;

        margin-right: 5px;

      }

      .rito-logs-box {

        background: #0f172a;

        color: #f1f5f9;

        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

        font-size: 11px;

        line-height: 1.4;

        padding: 8px;

        border-radius: 6px;

        height: 250px;

        overflow-y: auto;

        margin-top: 8px;

        box-sizing: border-box;

      }

      .rito-log-card {

        background: #1e293b;

        border: 1px solid #334155;

        border-radius: 5px;

        margin-bottom: 8px;

        overflow: hidden;

      }

      .rito-log-card-header {

        background: #0284c7;

        color: #ffffff;

        padding: 5px 8px;

        font-weight: 700;

        font-size: 11.5px;

        display: flex;

        justify-content: space-between;

        align-items: center;

      }

      .rito-log-card-body {

        padding: 6px 8px;

        font-size: 11px;

        color: #e2e8f0;

        display: flex;

        flex-direction: column;

        gap: 2.5px;

      }

      .rito-log-label {

        color: #38bdf8;

        font-weight: 700;

      }

      .rito-log-card-skipped {

        border: 1px solid #ef4444;

        background: #2a1215;

      }

      .rito-log-header-skipped {

        background: #dc2626;

        color: #ffffff;

      }

      .rito-log-alert-danger {

        color: #fca5a5;

        font-weight: 700;

        font-size: 11px;

        padding: 6px 8px;

      }

      .rito-log-card-error {

        border: 1px solid #ef4444;

        background: #2a1215;

      }

      .rito-log-header-error {

        background: #b91c1c;

        color: #ffffff;

      }

      .rito-log-card-summary {

        background: #1e293b;

        border: 1px solid #475569;

        border-radius: 6px;

        margin-top: 8px;

        overflow: hidden;

      }

      .rito-log-fallback-box {

        background: #3f2d12;

        border: 1px solid #78350f;

        border-radius: 4px;

        padding: 6px 8px;

        margin-top: 6px;

      }

      .rito-badge-success {

        background: #16a34a;

        color: #fff;

        padding: 1px 6px;

        border-radius: 3px;

        font-size: 10px;

        font-weight: bold;

      }

      .rito-badge-skipped {

        background: #dc2626;

        color: #fff;

        padding: 1px 6px;

        border-radius: 3px;

        font-size: 10px;

        font-weight: bold;

      }

      .rito-badge-error {

        background: #b91c1c;

        color: #fff;

        padding: 1px 6px;

        border-radius: 3px;

        font-size: 10px;

        font-weight: bold;

      }

      .rito-log-simple-msg {

        padding: 3px 4px;

        font-size: 11px;

        color: #94a3b8;

      }

      .rito-log-msg-warn {

        color: #facc15;

        font-weight: bold;

      }

      .rito-log-msg-success {

        color: #4ade80;

        font-weight: bold;

      }

      .rito-badge-p {

        display: inline-flex;

        align-items: center;

        justify-content: center;

        width: 17px;

        height: 17px;

        background: #16a34a;

        color: #ffffff !important;

        font-weight: 900;

        font-size: 11px;

        border-radius: 3.5px;

        line-height: 1;

        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);

      }

      .rito-topbar-btn {

        display: inline-flex;

        align-items: center;

        gap: 5px;

        background: #0077b6;

        color: #ffffff !important;

        border: none;

        border-radius: 4px;

        padding: 4px 10px;

        font-size: 12px;

        font-weight: 600;

        cursor: pointer;

        margin-left: 10px;

        text-decoration: none;

        box-shadow: 0 1px 3px rgba(0,0,0,0.15);

      }

      .rito-topbar-btn:hover {

        background: #005f92;

      }

      .diag-stat-card {

        transition: transform 0.15s, box-shadow 0.15s;

      }

      .diag-stat-card:hover {

        transform: translateY(-2px);

        box-shadow: 0 4px 10px rgba(0,0,0,0.08);

      }

      .diag-table {

        width: 100%;

        border-collapse: collapse;

        font-size: 11.5px;

      }

      .diag-table th {

        background: #f1f5f9;

        color: #334155;

        font-weight: 700;

        padding: 8px 10px;

        text-align: left;

        border-bottom: 2px solid #cbd5e1;

        position: sticky;

        top: 0;

        z-index: 2;

      }

      .diag-table td {

        padding: 7px 10px;

        border-bottom: 1px solid #e2e8f0;

        color: #1e293b;

        vertical-align: middle;

      }

      .diag-table tr:hover {

        background-color: #f8fafc;

      }



      /* Destaque Fluorescente no Campo Ativo & Tooltip ao Vivo */

      .eproc-campo-destaque-neon {

        outline: 2.5px solid #00ff66 !important;

        box-shadow: 0 0 12px rgba(0, 255, 102, 0.85), inset 0 0 4px rgba(0, 255, 102, 0.4) !important;

        transition: outline 0.08s ease, box-shadow 0.08s ease !important;

      }



      #eproc-tooltip-live-data {

        position: absolute;

        z-index: 2147483640;

        display: none;

        pointer-events: none;

        background: #0f172a;

        color: #f8fafc;

        border: 1.5px solid #00ff66;

        border-radius: 6px;

        padding: 4px 10px;

        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

        font-size: 11px;

        font-weight: 600;

        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45), 0 0 10px rgba(0, 255, 102, 0.5);

        white-space: nowrap;

        max-width: 460px;

        overflow: hidden;

        text-overflow: ellipsis;

        opacity: 0;

        transform: translateY(-2px);

        transition: opacity 0.1s ease, transform 0.1s ease;

      }



      #eproc-tooltip-live-data.visivel {

        display: block;

        opacity: 1;

        transform: translateY(0);

      }



      #eproc-tooltip-live-data .tooltip-badge-origem {

        background: #00ff66;

        color: #0f172a;

        padding: 1px 6px;

        border-radius: 3px;

        font-size: 9.5px;

        font-weight: 800;

        text-transform: uppercase;

        margin-right: 6px;

      }



    `;

    (document.head || document.documentElement).appendChild(st);

  }



  function salvarPosicao(p, min) {

    try {

      const r = p.getBoundingClientRect();

      const atual = JSON.parse(localStorage.getItem(KEY_POS) || '{}');

      localStorage.setItem(KEY_POS, JSON.stringify({

        left: Math.max(10, Math.min(window.innerWidth - 440, r.left)),

        top: Math.max(10, Math.min(window.innerHeight - 80, r.top)),

        min: typeof min === 'boolean' ? min : !!atual.min

      }));

    } catch (e) {}

  }



  function restaurarPosicao(p, btnMin) {

    try {

      const pos = JSON.parse(localStorage.getItem(KEY_POS) || 'null');

      if (!pos) return;

      if (typeof pos.left === 'number' && typeof pos.top === 'number') {

        const left = Math.max(10, Math.min(window.innerWidth - 440, pos.left));

        const top = Math.max(10, Math.min(window.innerHeight - 80, pos.top));

        p.style.left = left + 'px';

        p.style.top = top + 'px';

        p.style.right = 'auto';

        p.style.bottom = 'auto';

      }

      if (pos.min) {

        p.classList.add('rito-minimized');

        if (btnMin) btnMin.textContent = '+';

      }

    } catch (e) {}

  }



  function habilitarArraste(p, header) {

    let arrastando = false, offX = 0, offY = 0;

    header.addEventListener('mousedown', (e) => {

      if (e.target.closest('button')) return;

      arrastando = true;

      const r = p.getBoundingClientRect();

      offX = e.clientX - r.left;

      offY = e.clientY - r.top;

      p.style.right = 'auto';

      p.style.bottom = 'auto';

      p.style.left = r.left + 'px';

      p.style.top = r.top + 'px';

      e.preventDefault();

    });

    window.addEventListener('mousemove', (e) => {

      if (!arrastando) return;

      let x = e.clientX - offX;

      let y = e.clientY - offY;

      x = Math.max(10, Math.min(window.innerWidth - 440, x));

      y = Math.max(10, Math.min(window.innerHeight - 80, y));

      p.style.left = x + 'px';

      p.style.top = y + 'px';

    });

    window.addEventListener('mouseup', () => {

      if (!arrastando) return;

      arrastando = false;

      salvarPosicao(p);

    });

  }



  function criarPainel() {

    if (!ehTelaSuportada()) return; // não exibir em outras telas (ex.: painel principal)

    if (document.getElementById('rito-panel')) return;

    instalarHookGravarPreferencias();

    injetarEstilosPainel();



    const panel = document.createElement('div');

    panel.id = 'rito-panel';

    panel.innerHTML = `

      <div id="rito-panel-header" title="Arraste para mover o painel">

        <div class="rito-header-title">

          <span class="rito-badge-p" style="width: 19px; height: 19px; font-size: 12.5px;">P</span>

          <span id="rito-panel-title">Criar preferências em Lote 2G <span style="font-size:11px; font-weight:600; margin-left:3px; opacity:0.92;">v3.5.6</span></span>

        </div>

        <div class="rito-header-actions">

          <button type="button" class="rito-header-btn" id="btn-rito-manual" title="Instruções de Uso e Ajuda">?</button>

          <button type="button" class="rito-header-btn" id="btn-rito-min" title="Minimizar / Expandir">–</button>

        </div>

      </div>

      <div id="rito-panel-body">

        <div class="rito-card" style="padding: 9px 11px;">

          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:7px;">

            <div class="rito-card-title" style="margin-bottom:0; font-size:11px; text-transform:uppercase; letter-spacing:0.4px;">Módulo de Criação</div>

            <span id="rito-modulo-status-pill" style="font-size:10px; font-weight:700; padding:1px 6px; border-radius:10px; background:#dcfce7; color:#15803d;">2G</span>

          </div>

          <div class="rito-module-tabs">
            <div class="rito-module-row-1">
              <button type="button" id="btn-modulo-minutas" class="rito-btn-modulo ${moduloAtivo === 'minutas' ? 'active' : ''}" title="Módulo de Preferências de Minutas">
                <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
                <span>Minutas</span>
              </button>

              <button type="button" id="btn-modulo-relatorios" class="rito-btn-modulo ${moduloAtivo === 'relatorios' ? 'active' : ''}" title="Módulo de Preferências de Relatório Geral">
                <svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                <span>Relatórios</span>
              </button>

              <button type="button" id="btn-modulo-movimentacoes" class="rito-btn-modulo ${moduloAtivo === 'movimentacoes' ? 'active' : ''}" title="Módulo de Preferências de Movimentação Processual">
                <svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                <span>Movimentações</span>
              </button>
            </div>
            <div class="rito-module-row-2">
              <button type="button" id="btn-modulo-area-minutas" class="rito-btn-modulo ${moduloAtivo === 'area_minutas' ? 'active' : ''}" title="Módulo de Preferências da Área de Minutas (Documentos)">
                <svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                <span>Documentos</span>
              </button>

              <button type="button" id="btn-modulo-intimacoes" class="rito-btn-modulo ${moduloAtivo === 'intimacoes' ? 'active' : ''}" title="Módulo de Preferências de Intimação Eletrônica">
                <svg viewBox="0 0 24 24"><path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/><line x1="2" y1="3" x2="22" y2="21"/></svg>
                <span>Intimações</span>
              </button>
            </div>
          </div>

          <div class="rito-card-value" id="rito-status-tela" style="font-size:11.5px; line-height:1.4;">

            ${gerarStatusTelaHtml()}

          </div>

        </div>



        <div class="rito-dropzone" id="rito-dropzone">

          <div style="font-weight:700; font-size:12.5px; color:#005b8f;">📂 Selecionar Planilha Excel (.xlsx)</div>

          <div style="font-size:11px; color:#64748b; margin-top:2px;">Ou arraste a planilha da Unidade aqui</div>

          <input type="file" id="rito-file-input" accept=".xlsx,.xls,.csv,.tsv,.txt" style="display:none;" />

        </div>



        <div class="rito-card" id="rito-card-info" style="display:none;">

          <div class="rito-card-title">Planilha Carregada</div>

          <div class="rito-card-value" id="rito-planilha-nome">-</div>

          <div style="font-size:12px; color:#475569; margin-top:3px;" id="rito-planilha-qtd">-</div>

          

          <div style="margin-top:8px; display:flex; align-items:center; gap:8px;">

            <div style="flex:1;">

              <label style="font-size:11px; font-weight:700; color:#475569; display:block; margin-bottom:2px;">De (Nº da preferência):</label>

              <input type="number" id="inp-rito-de" min="1" value="1" style="width:100%; box-sizing:border-box; padding:5px 8px; border:1px solid #cbd5e1; border-radius:4px; font-weight:bold; color:#0f172a;" />

            </div>

            <div style="flex:1;">

              <label style="font-size:11px; font-weight:700; color:#475569; display:block; margin-bottom:2px;">Até (Nº da preferência):</label>

              <input type="number" id="inp-rito-ate" min="1" value="1" style="width:100%; box-sizing:border-box; padding:5px 8px; border:1px solid #cbd5e1; border-radius:4px; font-weight:bold; color:#0f172a;" />

            </div>

          </div>

        </div>



        <div class="rito-progress-wrap" id="rito-prog-wrap">

          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; font-size:11px; font-weight:700; color:#334155;">

            <span id="rito-prog-label">Progresso:</span>

            <span id="rito-prog-text" style="color:#0077b6; font-size:12px; font-weight:800;">0 / 0</span>

          </div>

          <div style="background:#e2e8f0; border-radius:6px; height:8px; overflow:hidden;">

            <div class="rito-progress-bar" id="rito-prog-bar"></div>

          </div>

          <div id="rito-prog-subtext" style="font-size:10.5px; color:#64748b; margin-top:3px; display:none; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"></div>

        </div>



        <button type="button" class="rito-btn" id="btn-rito-diagnostico" style="display:none; background:#0284c7; border-color:#0369a1; color:#ffffff; font-weight:700; margin-top:6px;" title="Executa a verificação prévia completa da planilha contra os cadastros desta Vara no eproc">

          <span>🔍</span> Verificação prévia

        </button>



        <button type="button" class="rito-btn rito-btn-primary" id="btn-rito-iniciar" style="display:none;">

          <span>🚀</span> Iniciar Criação em Lote

        </button>





        <button type="button" class="rito-btn rito-btn-danger" id="btn-rito-parar" style="display:none;">

          <span>🛑</span> !Parar execução

        </button>



        <div style="display:flex; gap:6px; margin-top:6px;">

          <button type="button" class="rito-btn rito-btn-secondary" id="btn-rito-ajuda" style="flex:1;">

            <span>📖</span> Instruções

          </button>

          <button type="button" class="rito-btn rito-btn-secondary" id="btn-rito-limpar" style="flex:1;">

            <span>🗑️</span> Limpar cache

          </button>

        </div>



        <div style="margin-top:8px; border-top:1px solid #e2e8f0; padding-top:6px;">

          <button type="button" class="rito-btn rito-btn-secondary" id="btn-rito-abrir-gerenciador" style="width:100%; font-size:11.5px;" title="Abre a tela oficial do eproc para visualizar ou editar preferências">

            <span>📋</span> Abrir Gerenciador de Preferências do eproc

          </button>

        </div>



        <div id="rito-logs-section" style="margin-top: 10px;">

          <div id="rito-logs-header-toggle" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; padding: 7px 10px; background: #e2e8f0; border-radius: 6px; font-size: 11.5px; font-weight: 700; color: #334155; user-select: none; transition: background 0.15s;" title="Clique para expandir ou recolher a tela de logs">

            <span id="rito-logs-title-text">📜 Logs e Relatório da Execução (Recolhido)</span>

            <span id="rito-logs-toggle-arrow" style="color: #0284c7; font-weight: bold;">▶ Expandir</span>

          </div>

          <div class="rito-logs-box" id="rito-logs" style="display: none; max-height: 380px; overflow-y: auto; margin-top: 6px;">Aguardando planilha...</div>

        </div>

      </div>

    `;



    (document.body || document.documentElement).appendChild(panel);



    const header = panel.querySelector('#rito-panel-header');

    header.style.background = corInstancia();



    // Listeners do seletor de módulos (Minutas / Relatórios / Movimentações)

    const btnModMin = document.getElementById('btn-modulo-minutas');

    const btnModRel = document.getElementById('btn-modulo-relatorios');

    const btnModMov = document.getElementById('btn-modulo-movimentacoes');

    if (btnModMin) {

      btnModMin.onclick = () => alternarModulo('minutas');

    }

    if (btnModRel) {

      btnModRel.onclick = () => alternarModulo('relatorios');

    }

    if (btnModMov) {

      btnModMov.onclick = () => alternarModulo('movimentacoes');

    }

    const btnModAreaMin = document.getElementById('btn-modulo-area-minutas');
    if (btnModAreaMin) {
      btnModAreaMin.onclick = () => alternarModulo('area_minutas');
    }

    const btnModIntim = document.getElementById('btn-modulo-intimacoes');
    if (btnModIntim) {
      btnModIntim.onclick = () => alternarModulo('intimacoes');
    }



    const logsToggle = document.getElementById('rito-logs-header-toggle');

    const logsBox = document.getElementById('rito-logs');

    const logsArrow = document.getElementById('rito-logs-toggle-arrow');

    const logsTitle = document.getElementById('rito-logs-title-text');

    if (logsToggle && logsBox && logsArrow) {

      logsToggle.onclick = () => {

        const estaOculto = logsBox.style.display === 'none';

        logsBox.style.display = estaOculto ? 'block' : 'none';

        logsArrow.textContent = estaOculto ? '▼ Recolher' : '▶ Expandir';

        if (logsTitle) {

          logsTitle.textContent = estaOculto ? '📜 Logs e Relatório da Execução' : '📜 Logs e Relatório da Execução (Recolhido)';

        }

      };

    }



    // RESTAURA HISTÓRICO DE LOGS CASO O USUÁRIO DÊ F5 OU RECARREGUE A PÁGINA

    try {

      const logsSalvos = sessionStorage.getItem(SESSION_KEY_LOGS);

      if (logsSalvos && logsSalvos.trim() && logsSalvos.trim() !== 'Aguardando planilha...') {

        logsBox.innerHTML = logsSalvos;

        logsBox.style.display = 'block';

        if (logsArrow) logsArrow.textContent = '▼ Recolher';

        if (logsTitle) logsTitle.textContent = '📜 Logs e Relatório da Execução';



        if (!logsBox.querySelector('#rito-log-restaurado-aviso')) {

          const avisoWrap = document.createElement('div');

          avisoWrap.id = 'rito-log-restaurado-aviso';

          avisoWrap.style.cssText = 'padding:6px 10px; margin-bottom:8px; border-radius:6px; background:#1e293b; border:1px solid #3b82f6; color:#93c5fd; font-size:11px; display:flex; justify-content:space-between; align-items:center;';

          avisoWrap.innerHTML = `

            <span>📋 <strong>Logs preservados</strong> (mesmo após F5)</span>

            <button type="button" id="btn-rito-limpar-logs-top" style="background:#ef4444; color:#fff; border:none; border-radius:4px; padding:2px 8px; cursor:pointer; font-size:10px; font-weight:600;">Limpar Logs</button>

          `;

          logsBox.insertBefore(avisoWrap, logsBox.firstChild);

        }



        const btnLimparTop = logsBox.querySelector('#btn-rito-limpar-logs-top');

        if (btnLimparTop) {

          btnLimparTop.onclick = () => {

            sessionStorage.removeItem(SESSION_KEY_LOGS);

            logsBox.innerHTML = '<span style="color:#64748b; font-size:12px;">Aguardando planilha...</span>';

          };

        }

      }

    } catch (e) {}



    const btnMin = document.getElementById('btn-rito-min');

    btnMin.onclick = () => {

      const min = panel.classList.toggle('rito-minimized');

      btnMin.textContent = min ? '+' : '–';

      salvarPosicao(panel, min);

    };



    habilitarArraste(panel, header);

    restaurarPosicao(panel, btnMin);



    const abrirInstrucoes = (e) => {

      if (e) e.stopPropagation();

      window.postMessage({ tipo: 'EPROC_ABRIR_INSTRUCOES' }, '*');

    };

    document.getElementById('btn-rito-manual').onclick = abrirInstrucoes;

    document.getElementById('btn-rito-ajuda').onclick = abrirInstrucoes;



    document.getElementById('btn-rito-limpar').onclick = () => {

      try { sessionStorage.removeItem(SESSION_KEY_LOGS); } catch (e) {}

      window._eprocPararLote = true;

      execucaoLoteAtiva = false;

      gravacaoEmAndamento = false;

    clearState();

      location.reload();

    };



    const drop = document.getElementById('rito-dropzone');

    const finp = document.getElementById('rito-file-input');

    drop.onclick = () => finp.click();

    drop.ondragover = (e) => { e.preventDefault(); drop.style.borderColor = '#0088cc'; };

    drop.ondragleave = () => { drop.style.borderColor = '#94a3b8'; };

    drop.ondrop = (e) => {

      e.preventDefault();

      drop.style.borderColor = '#94a3b8';

      if (e.dataTransfer.files && e.dataTransfer.files[0]) carregarArquivo(e.dataTransfer.files[0]);

    };

    finp.onchange = (e) => {

      if (e.target.files && e.target.files[0]) carregarArquivo(e.target.files[0]);

    };



    const btnGerenciador = document.getElementById('btn-rito-abrir-gerenciador');

    if (btnGerenciador) {

      // Ajusta o texto inicial conforme o módulo salvo

      if (moduloAtivo === 'relatorios') {

        btnGerenciador.innerHTML = '<span>📋</span> Listar Preferências de Relatório Geral';

        btnGerenciador.title = 'Abre a lista de preferências de Relatório Geral da Unidade';

      } else if (moduloAtivo === 'movimentacoes') {

        btnGerenciador.innerHTML = '<span>📋</span> Abrir Gerenciador de Preferências (Movimentação)';

        btnGerenciador.title = 'Abre a tela oficial do eproc para visualizar ou editar preferências de Movimentação Processual';

      } else if (moduloAtivo === 'area_minutas') {

        btnGerenciador.innerHTML = '<span>📋</span> Listar Preferências da Área de Minutas';

        btnGerenciador.title = 'Abre a lista de preferências da Área de Trabalho de Minutas';

      }

      btnGerenciador.onclick = () => {

        if (moduloAtivo === 'relatorios') {

          const btnListaRel = document.getElementById('selPreferencia-list') || document.getElementById('selPreferencia-listAll');

          if (btnListaRel) {

            dispararClique(btnListaRel);

            addLog('📋 Lista de preferências de Relatório Geral aberta.');

          } else {

            addLog('⚠️ Botão selPreferencia-list não encontrado na tela de Relatório Geral.', 'warn');

          }

        } else if (moduloAtivo === 'area_minutas') {

          const btnLista = document.getElementById('listaPreferencias') || document.getElementById('lblListarPreferencia');

          if (btnLista) {

            dispararClique(btnLista);

            addLog('📋 Lista de preferências da Área de Minutas aberta.');

          } else {

            const hashAtual = typeof obterHashAtual === 'function' ? obterHashAtual() : '';

            window.open('controlador.php?acao=formulario_personalizacao_listar&nome_acao=minuta_area_trabalho&acao_origem=minuta_area_trabalho&hash=' + hashAtual, '_blank');

          }

        } else {

          const btnLista = document.getElementById('listaPreferencias');

          if (btnLista) {

            dispararClique(btnLista);

            addLog(`📋 Gerenciador nativo de preferências de ${moduloAtivo === 'movimentacoes' ? 'Movimentações' : 'Minutas'} aberto.`);

          } else {

            addLog('⚠️ Botão listaPreferencias não encontrado na tela.', 'warn');

          }

        }

      };

    }



    const btnDiag = document.getElementById('btn-rito-diagnostico');
    if (btnDiag) btnDiag.onclick = executarDiagnosticoPreVoo;
    document.getElementById('btn-rito-iniciar').onclick = iniciarExecucao;



    const btnPararEl = document.getElementById('btn-rito-parar');

    btnPararEl.onclick = () => {

      window._eprocPararLote = true;

      btnPararEl.disabled = true;

      btnPararEl.innerHTML = '<span>⏳</span> Parando...';

      addLog('⚠️ Solicitada a parada da execução.', 'warn');

      setTimeout(async () => {

        await restaurarTelaInicialEproc();

      }, 800);

    };



    // injetarBotaoBarraSuperior(panel, btnMin); -- Removido conforme solicitado: não fixar botão na barra do eproc

  }



  function injetarBotaoBarraSuperior(panel, btnMin) {

    const existing = document.getElementById('btn-eproc-pref-topbar');

    if (existing) existing.remove();

    return; // Desativado

    if (document.getElementById('btn-eproc-pref-topbar')) return;

    const target = document.querySelector('#navbar-accessibility, #divInfraBarraSistemaE, .infraBarraComandos, .infraBarraSistema');

    if (!target) return;



    const b = document.createElement('button');

    b.id = 'btn-eproc-pref-topbar';

    b.type = 'button';

    b.className = 'rito-topbar-btn';

    b.innerHTML = '<span class="rito-badge-p">P</span> Preferências 2G';

    b.title = 'Abrir / Restaurar Painel de Criação de Preferências em Lote 2G';

    b.onclick = () => {

      panel.style.display = 'block';

      panel.classList.remove('rito-minimized');

      if (btnMin) btnMin.textContent = '–';

      panel.style.left = 'auto';

      panel.style.top = 'auto';

      panel.style.right = '18px';

      panel.style.bottom = '18px';

      salvarPosicao(panel, false);

    };

    target.appendChild(b);

  }



  function addLog(msg, tipo = 'info') {

    const box = document.getElementById('rito-logs');

    if (!box) return;

    if (box.textContent.trim() === 'Aguardando planilha...') {

      box.innerHTML = '';

    }

    const d = document.createElement('div');

    d.className = `rito-log-simple-msg rito-log-msg-${tipo}`;

    d.textContent = msg;

    box.appendChild(d);

    /* rolagem automática do log desativada */

    salvarLogsNoStorage();

  }



  function renderizarLogCard(dados) {

    const box = document.getElementById('rito-logs');

    if (!box) return;

    if (box.textContent.trim() === 'Aguardando planilha...') box.innerHTML = '';



    const card = document.createElement('div');

    card.className = 'rito-log-card';



    if (moduloAtivo === 'relatorios') {
      card.innerHTML = `
        <div class="rito-log-card-header">
          <span>📋 Linha ${dados.linha} (Planilha): "${dados.nome}"</span>
          <span class="rito-badge-success">✅ Salva (Relatório)</span>
        </div>
        <div class="rito-log-card-body">
          <div><span class="rito-log-label">• Nome:</span> ${dados.nome}</div>
          <div><span class="rito-log-label">• Tipo:</span> ${dados.tipoPref || 'Unidade'}</div>
          <div><span class="rito-log-label">• Grupo:</span> ${dados.grupo || '(Nenhum)'}</div>
          <div><span class="rito-log-label">• Painel Inicial:</span> ${dados.acaoPref}</div>
          <div><span class="rito-log-label">• Operador Localizador:</span> ${dados.operacao || 'E'}</div>
          <div><span class="rito-log-label">• Localizadores Filtro:</span> ${dados.localizadores}</div>
          <div><span class="rito-log-label">• Situação Processual:</span> ${dados.situacao || 'TODOS'}</div>
          <div><span class="rito-log-label">• Lembrete:</span> ${dados.lembrete || '-'}</div>
        </div>
      `;
      box.appendChild(card);
      salvarLogsNoStorage();
      return;
    }

    if (moduloAtivo === 'movimentacoes') {
      card.innerHTML = `
        <div class="rito-log-card-header">
          <span>📋 Linha ${dados.linha} (Planilha): "${dados.nome}"</span>
          <span class="rito-badge-success">✅ Criada (Movimentação)</span>
        </div>
        <div class="rito-log-card-body">
          <div><span class="rito-log-label">• Nome:</span> ${dados.nome}</div>
          <div><span class="rito-log-label">• Tipo:</span> ${dados.tipoPref || 'Unidade'}</div>
          <div><span class="rito-log-label">• Grupo:</span> ${dados.grupo || '(Nenhum - sem grupo)'}</div>
          <div><span class="rito-log-label">• Ação Preferencial:</span> ${dados.acaoPref}</div>
          <div><span class="rito-log-label">• Evento Lançado:</span> <span style="color:#38bdf8; font-weight:600;">${dados.evento}</span></div>
          <div><span class="rito-log-label">• Comportamento Loc.:</span> ${dados.comportamento}</div>
          <div><span class="rito-log-label">• Novo Localizador:</span> ${dados.locPrincipal || '(Nenhum)'}</div>
          ${dados.locDesativar ? `<div><span class="rito-log-label">• Localizador a Desativar:</span> ${dados.locDesativar}</div>` : ''}
          ${dados.motivo ? `<div><span class="rito-log-label">• Motivo:</span> ${dados.motivo}</div>` : ''}
          ${dados.processoAberto ? `<div><span class="rito-log-label">• Processo Aberto:</span> ${dados.processoAberto}</div>` : ''}
        </div>
      `;
      box.appendChild(card);
      salvarLogsNoStorage();
      return;
    }

    if (moduloAtivo === 'area_minutas') {
      card.innerHTML = `
        <div class="rito-log-card-header">
          <span>📋 Linha ${dados.linha} (Planilha): "${dados.nome}"</span>
          <span class="rito-badge-success">✅ Salva (Documentos)</span>
        </div>
        <div class="rito-log-card-body">
          <div><span class="rito-log-label">• Nome:</span> ${dados.nome}</div>
          <div><span class="rito-log-label">• Tipo:</span> ${dados.tipoPref || 'Unidade'}</div>
          <div><span class="rito-log-label">• Exibir no Painel Inicial:</span> ${dados.exibirPainel !== false ? 'Sim' : 'Não'}</div>
          <div><span class="rito-log-label">• Grupo:</span> ${dados.grupo || '(Nenhum)'}</div>
          <div><span class="rito-log-label">• Órgão Proprietário:</span> ${dados.orgaoProprietario || '-'}</div>
          <div><span class="rito-log-label">• Tipo de Documento:</span> ${dados.tipoDocumento || '-'}</div>
          <div><span class="rito-log-label">• Status da Minuta:</span> ${dados.statusMinuta || 'Todas'}</div>
          <div><span class="rito-log-label">• Localizador:</span> ${dados.localizador || '(Qualquer / Não filtrado)'}</div>
          ${dados.usuarioCriador ? `<div><span class="rito-log-label">• Usuário Criador:</span> ${dados.usuarioCriador}</div>` : ''}
        </div>
      `;
      box.appendChild(card);
      salvarLogsNoStorage();
      return;
    }

    if (moduloAtivo === 'intimacoes') {
      card.innerHTML = `
        <div class="rito-log-card-header">
          <span>📋 Linha ${dados.linha} (Planilha): "${dados.nome}"</span>
          <span class="rito-badge-success">✅ Criada (Intimação)</span>
        </div>
        <div class="rito-log-card-body">
          <div><span class="rito-log-label">• Nome:</span> ${dados.nome}</div>
          <div><span class="rito-log-label">• Tipo:</span> ${dados.tipoPref || 'Unidade'}</div>
          <div><span class="rito-log-label">• Grupo:</span> ${dados.grupo || '(Nenhum - sem grupo)'}</div>
          <div><span class="rito-log-label">• Ação Preferencial:</span> ${dados.acaoPref}</div>
          <div><span class="rito-log-label">• Evento Judicial:</span> <span style="color:#38bdf8; font-weight:600;">${dados.evento}</span></div>
          <div><span class="rito-log-label">• Modo de Prazos:</span> ${dados.modoPrazos || 'Por Polo'}</div>
          ${dados.prazoMP ? `<div><span class="rito-log-label">• Prazo MP (Custos iuris):</span> ${dados.prazoMP} dias</div>` : ''}
          ${dados.prazoAutores ? `<div><span class="rito-log-label">• Prazo Autores:</span> ${dados.prazoAutores} dias</div>` : ''}
          ${dados.prazoReus ? `<div><span class="rito-log-label">• Prazo Réus:</span> ${dados.prazoReus} dias</div>` : ''}
          ${dados.prazoEspEnt ? `<div><span class="rito-log-label">• Prazo Especial Entidades:</span> ${dados.prazoEspEnt} dias</div>` : ''}
          ${dados.prazoSimpDemais ? `<div><span class="rito-log-label">• Prazo Simples Partes:</span> ${dados.prazoSimpDemais} dias</div>` : ''}
          <div><span class="rito-log-label">• Intimação Urgente:</span> ${dados.urgente ? 'Sim' : 'Não'}</div>
          <div><span class="rito-log-label">• Comportamento Loc.:</span> ${dados.comportamento}</div>
          <div><span class="rito-log-label">• Novo Localizador:</span> ${dados.locPrincipal || '(Nenhum)'}</div>
          ${dados.locDesativar ? `<div><span class="rito-log-label">• Localizador a Desativar:</span> ${dados.locDesativar}</div>` : ''}
        </div>
      `;
      box.appendChild(card);
      salvarLogsNoStorage();
      return;
    }



    const secTxt = Array.isArray(dados.locSecundarios) ? dados.locSecundarios.join('; ') : dados.locSecundarios;



    card.innerHTML = `

      <div class="rito-log-card-header">

        <span>📋 Linha ${dados.linha} (Planilha): "${dados.nome}"</span>

        <span class="rito-badge-success">✅ Criada</span>

      </div>

      <div class="rito-log-card-body">

        <div><span class="rito-log-label">• Nome:</span> ${dados.nome}</div>

        <div><span class="rito-log-label">• Tipo:</span> ${dados.tipoPref}</div>

        <div><span class="rito-log-label">• Como salvar:</span> ${dados.comoSalvar}</div>

        <div><span class="rito-log-label">• Ação Preferencial:</span> ${dados.acaoPref}</div>

        <div><span class="rito-log-label">• Modelo:</span> ${dados.modelo}</div>

        <div><span class="rito-log-label">• Agendamento:</span> ${dados.agendamento}</div>

        <div><span class="rito-log-label">• Evento:</span> ${dados.evento}</div>${dados.eventosComp && dados.eventosComp.length > 0 ? `<div><span class="rito-log-label">• Eventos Complementares:</span> <span style="color:#10b981; font-weight:600;">${dados.eventosComp.join('; ')}</span></div>` : ''}${dados.dadosComplementares ? `<div><span class="rito-log-label">• Dados Complementares:</span> <span style="color:#f59e0b; font-weight:600;">${dados.dadosComplementares}</span></div>` : ''}

        <div><span class="rito-log-label">• Comportamento:</span> ${dados.comportamento}</div>

        <div><span class="rito-log-label">• Localizador Principal:</span> ${dados.locPrincipal}</div>

        <div><span class="rito-log-label">• Localizadores Secundários:</span> ${secTxt || '(Nenhum)'}</div>

        <div><span class="rito-log-label">• Classificação:</span> ${dados.classificacao || '(Em branco)'}</div>${dados.urgenciaMandado ? `<div><span class="rito-log-label">• Urgência Mandado:</span> <span style="color:#60a5fa; font-weight:600;">${dados.urgenciaMandado}</span></div>` : ''}

        <div><span class="rito-log-label">• Descrição da Minuta:</span> ${dados.descricao || '(Em branco)'}</div>

        <div><span class="rito-log-label">• Assinante:</span> ${dados.assinante}</div>

        <div><span class="rito-log-label">• Status Destino:</span> ${dados.statusDestino}</div>

      </div>

    `;



    box.appendChild(card);

    /* rolagem automática do log desativada */

    salvarLogsNoStorage();

  }



  function renderizarLogCardSkipped(item, motivo = 'Essa preferência já existe na unidade') {

    const box = document.getElementById('rito-logs');

    if (!box) return;

    if (box.textContent.trim() === 'Aguardando planilha...') box.innerHTML = '';



    const card = document.createElement('div');

    card.className = 'rito-log-card rito-log-card-skipped';



    card.innerHTML = `

      <div class="rito-log-card-header rito-log-header-skipped">

        <span>⚠️ Linha ${item.linha} (Planilha): "${item.nome}"</span>

        <span class="rito-badge-skipped">⛔ Pulada</span>

      </div>

      <div class="rito-log-alert-danger">

        ⚠️ ${motivo}

      </div>

    `;



    box.appendChild(card);

    /* rolagem automática do log desativada */

    salvarLogsNoStorage();

  }



  function renderizarLogCardErro(item, erro) {

    const box = document.getElementById('rito-logs');

    if (!box) return;

    if (box.textContent.trim() === 'Aguardando planilha...') box.innerHTML = '';



    const card = document.createElement('div');

    card.className = 'rito-log-card rito-log-card-error';



    card.innerHTML = `

      <div class="rito-log-card-header rito-log-header-error">

        <span>❌ Linha ${item.linha} (Planilha): "${item.nome}"</span>

        <span class="rito-badge-error">Erro</span>

      </div>

      <div class="rito-log-alert-danger">

        ${erro}

      </div>

    `;



    box.appendChild(card);

    /* rolagem automática do log desativada */

    salvarLogsNoStorage();

  }



  function formatarTempoExecucao(ms, inicioDate, fimDate) {

    const duracaoMs = Math.max(0, ms);

    const totalSeg = Math.round(duracaoMs / 1000);

    const horas = Math.floor(totalSeg / 3600);

    const minutos = Math.floor((totalSeg % 3600) / 60);

    const segundos = totalSeg % 60;



    let duracaoStr = '';

    if (duracaoMs < 10000) {

      duracaoStr = `${(duracaoMs / 1000).toFixed(1).replace('.', ',')}s`;

    } else {

      const partes = [];

      if (horas > 0) partes.push(`${horas}h`);

      if (minutos > 0 || horas > 0) partes.push(`${minutos}min`);

      partes.push(`${segundos}s`);

      duracaoStr = partes.join(' ');

    }



    if (inicioDate && fimDate) {

      const fmtHora = (d) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      return `${duracaoStr} (${fmtHora(inicioDate)} às ${fmtHora(fimDate)})`;

    }

    return duracaoStr;

  }



  function renderizarResumoFinal(processados, total, criadas, puladas, fallbacks, totalClassifsCriadas = 0, tempoExecucaoStr = '', tempoGeralStr = '') {

    const box = document.getElementById('rito-logs');

    if (!box) return;



    const card = document.createElement('div');

    card.className = 'rito-log-card rito-log-card-summary';



    let fallbacksHtml = '';

    if (fallbacks.length > 0) {

      fallbacksHtml = `

        <div class="rito-log-fallback-box">

          <div style="font-weight:700; color:#fbbf24; font-size:11.5px; margin-bottom:4px;">

            ⚠️ Para as preferências listadas abaixo, não foram encontrados um ou mais localizadores. Como padrão, foram incluídos os localizadores ARQUIVO - ARQUIVO e BAIXADOS - BAIXADOS:

          </div>

          ${fallbacks.map(f => `

            <div style="margin-top:4px; padding:3px 0; border-bottom:1px dashed #78350f;">

              • <b>Linha ${f.linha}:</b> "${f.nome}"<br>

              ${f.principal ? `<span style="color:#cbd5e1; font-size:10.5px; margin-left:12px;">↳ Novo Localizador: "${f.principal}" ➔ <b>ARQUIVO - ARQUIVO</b></span><br>` : ''}

              ${f.secundarios ? `<span style="color:#cbd5e1; font-size:10.5px; margin-left:12px;">↳ Outros Localizadores: "${f.secundarios}" ➔ <b>BAIXADOS - BAIXADOS</b></span>` : ''}

            </div>

          `).join('')}

        </div>

      `;

    } else {

      fallbacksHtml = `

        <div style="color:#4ade80; font-weight:700; margin-top:6px; font-size:11.5px;">

          ✅ Todos os localizadores usados foram encontrados na unidade.

        </div>

      `;

    }



    card.innerHTML = `

      <div class="rito-log-card-header" style="background:#334155;">

        <span>🏁 RESUMO DO LOTE</span>

        <span>${processados} de ${total}</span>

      </div>

      <div class="rito-log-card-body" style="gap:5px; font-size:12px;">

        <div><b>• Total processado:</b> ${processados} de ${total} preferências</div>

        <div><b>• Criadas com sucesso:</b> <span style="color:#4ade80; font-weight:bold;">${criadas}</span></div>

        <div><b>• Puladas (já existentes):</b> <span style="color:#f87171; font-weight:bold;">${puladas}</span></div>

        <div><b>• Classificações criadas:</b> <span style="color:#60a5fa; font-weight:bold;">${totalClassifsCriadas}</span></div>

        ${tempoExecucaoStr ? `<div><b>• Tempo de execução:</b> <span style="color:#fbbf24; font-weight:bold;">⏱️ ${tempoExecucaoStr}</span></div>` : ''}

        ${tempoGeralStr ? `<div style="font-size:11px; color:#cbd5e1; margin-left:12px;">↳ <i>Incluindo Verificação Prévia: ${tempoGeralStr}</i></div>` : ''}

        ${fallbacksHtml}

      </div>

    `;



    box.appendChild(card);

    /* rolagem automática do log desativada */

    salvarLogsNoStorage();

  }



  async function obterPreferenciasExistentes() {

    const nomes = new Set();

    const todas = await obterTodasPreferenciasUnidade();

    todas.forEach(p => {

      if (p.nome) nomes.add(p.nome.trim());

    });

    return nomes;

  }



  function preferenciaJaExiste(nomeDesejado, conjuntoExistentes) {

    if (!nomeDesejado || !conjuntoExistentes || conjuntoExistentes.size === 0) return false;

    for (const ex of conjuntoExistentes) {

      if (saoPreferenciasIguais(nomeDesejado, ex)) return true;

    }

    return false;

  }



  let itensCarregados = [];



  async function carregarArquivo(file) {

    try { sessionStorage.removeItem(SESSION_KEY_LOGS); } catch (e) {}

    addLog(`Lendo arquivo: ${file.name}...`);

    try {

      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {

        const res = await lerPlanilhaExcel(file);

        itensCarregados = res.itens;

        document.getElementById('rito-planilha-nome').textContent = `${file.name} (Aba: ${res.sheetName})`;

      } else {

        const txt = await file.text();

        itensCarregados = lerTextoDelimitado(txt);

        document.getElementById('rito-planilha-nome').textContent = file.name;

      }



      const total = itensCarregados.length;

      document.getElementById('rito-planilha-qtd').innerHTML = `<b>${total}</b> preferências carregadas prontas para processar.`;



      const inpDe = document.getElementById('inp-rito-de');

      const inpAte = document.getElementById('inp-rito-ate');

      if (inpDe && inpAte) {

        inpDe.min = 1;

        inpDe.max = total;

        inpDe.value = 1;



        inpAte.min = 1;

        inpAte.max = total;

        inpAte.value = total;

      }



      document.getElementById('rito-card-info').style.display = 'block';
      document.getElementById('btn-rito-diagnostico').style.display = 'flex';
      document.getElementById('btn-rito-iniciar').style.display = 'flex';



      addLog(`Planilha carregada com sucesso! Total: ${total} preferências.`);

    } catch (err) {

      addLog(`ERRO ao ler arquivo: ${err.message}`);

      alertOriginal.call(window, 'Erro ao carregar planilha: ' + err.message);

    }

  }



  async function iniciarExecucao() {
    if (ehTelaDeIntimacao()) {
      moduloAtivo = 'intimacoes';
    } else if (ehTelaDeRelatorio()) {
      moduloAtivo = 'relatorios';
    } else if (ehTelaDeMovimentacao()) {
      moduloAtivo = 'movimentacoes';
    } else if (ehTelaDeMinutaAreaTrabalho()) {
      moduloAtivo = 'area_minutas';
    } else if (ehTelaDeMinuta()) {
      moduloAtivo = 'minutas';
    }

    if (moduloAtivo === 'relatorios') {

      if (!ehTelaDeRelatorio()) {

        alertOriginal.call(window, 'Acesse a tela de "Relatório Geral de Processos" para criar as preferências de relatório.');

        return;

      }

    } else if (moduloAtivo === 'movimentacoes') {

      if (!ehTelaDeMovimentacao()) {

        alertOriginal.call(window, 'Acesse a tela de "Movimentação Processual" para criar as preferências de movimentação.');

        return;

      }

    } else if (moduloAtivo === 'area_minutas') {

      if (!ehTelaDeMinutaAreaTrabalho()) {

        alertOriginal.call(window, 'Acesse a tela de "Minutas > Área de Trabalho" para criar as preferências de documentos.');

        return;

      }

    } else if (moduloAtivo === 'intimacoes') {

      if (!ehTelaDeIntimacao()) {

        alertOriginal.call(window, 'Acesse a tela de "Intimação Eletrônica" de um processo para criar as preferências de intimação.');

        return;

      }

    } else {

      if (!ehTelaDeMinuta()) {

        alertOriginal.call(window, 'Acesse a tela de "Nova Minuta" para criar as preferências de minuta.');

        return;

      }

    }

    if (!itensCarregados.length) {

      alertOriginal.call(window, 'Nenhuma preferência carregada da planilha.');

      return;

    }



    window._eprocPararLote = false;

    execucaoLoteAtiva = true;

    const inicioExecucaoMs = Date.now();

    window._eprocInicioLoteMs = inicioExecucaoMs;

    clearState();



    // Reset total do formulário antes de iniciar o lote
    if (moduloAtivo === 'minutas') {
      resetarFormularioCompletamente();
    } else if (moduloAtivo === 'movimentacoes') {
      resetarFormularioMovimentacao();
    } else if (moduloAtivo === 'intimacoes') {
      resetarFormularioIntimacao();
    }

    await sleep(200);



    const de = parseInt(document.getElementById('inp-rito-de').value, 10) || 1;

    const ate = parseInt(document.getElementById('inp-rito-ate').value, 10) || itensCarregados.length;



    const ini = Math.max(0, de - 1);

    const fim = Math.min(itensCarregados.length, Math.max(de, ate));



    const listaParaExecutar = itensCarregados.slice(ini, fim);



    document.getElementById('btn-rito-iniciar').style.display = 'none';

    document.getElementById('btn-rito-parar').style.display = 'flex';

    document.getElementById('rito-prog-wrap').style.display = 'block';

    const progLabelEl = document.getElementById('rito-prog-label');

    if (progLabelEl) progLabelEl.textContent = 'Executando lote:';

    const progSubtextEl = document.getElementById('rito-prog-subtext');

    if (progSubtextEl) {

      progSubtextEl.style.display = 'block';

      progSubtextEl.textContent = 'Preparando verificação da Unidade...';

    }

    const progTextEl = document.getElementById('rito-prog-text');

    const progBarEl = document.getElementById('rito-prog-bar');

    if (progTextEl) progTextEl.textContent = '0 / ' + listaParaExecutar.length;

    if (progBarEl) {

      progBarEl.style.width = '4%';

      progBarEl.classList.add('rito-progress-active');

    }



    const st = {

      running: true,

      idx: 0,

      total: listaParaExecutar.length,

      itens: listaParaExecutar,

      de: de,

      ate: ate,

      inicioMs: inicioExecucaoMs,

      inicioAuditoriaMs: window._eprocInicioAuditoriaPreviaMs || null

    };

    saveState(st);



    addLog(`=== INICIANDO LOTE: preferências de ${de} até ${ate} (${st.total} itens) ===`);

    executarLoopLote(st);

  }



  async function executarLoopLote(st) {

    totalClassificacoesCriadasNoLote = 0;

    const inicioLoteMs = st.inicioMs || Date.now();

    let ultimoSalvamentoMs = 0;

    let totalCriadas = 0;

    let totalPuladas = 0;

    const listaFallbacks = [];



    let existentes = new Set();

    if (moduloAtivo === 'relatorios') {

      addLog('🔍 Verificando preferências de relatório já cadastradas na Unidade...', 'info');

      existentes = await obterPreferenciaRelatorioExistentes();

      addLog('ℹ️ Encontradas ' + existentes.size + ' preferências de relatório cadastradas na Unidade.', 'info');

      await garantirGruposRelatoriosEmLote(st.itens);

    } else if (moduloAtivo === 'movimentacoes') {

      addLog('🔍 Verificando preferências de movimentação já cadastradas na Unidade...', 'info');

      existentes = await obterPreferenciasExistentes();

      addLog(`ℹ️ Encontradas ${existentes.size} preferências de movimentação cadastradas na Unidade.`, 'info');

      await garantirGruposRelatoriosEmLote(st.itens);

      addLog('📚 Mapeando catálogo de eventos da Movimentação Processual...', 'info');

      const catEv = await obterCatalogoEventosMovimentacao();

      addLog(`✓ Catálogo de eventos pronto: ${catEv.length} evento(s) disponível(is).`, 'info');

    } else if (moduloAtivo === 'area_minutas') {

      addLog('🔍 Verificando preferências da Área de Minutas já cadastradas na Unidade...', 'info');

      existentes = await obterPreferenciaAreaMinutasExistentes();

      addLog(`ℹ️ Encontradas ${existentes.size} preferências da Área de Minutas cadastradas na Unidade.`, 'info');

      await garantirGruposRelatoriosEmLote(st.itens);

    } else if (moduloAtivo === 'intimacoes') {

      addLog('🔍 Verificando preferências de intimação já cadastradas na Unidade...', 'info');

      existentes = await obterPreferenciaIntimacaoExistentes();

      addLog(`ℹ️ Encontradas ${existentes.size} preferências de intimação cadastradas na Unidade.`, 'info');

      await garantirGruposRelatoriosEmLote(st.itens);

    } else {

      addLog('🔍 Verificando preferências já cadastradas na Unidade...', 'info');

      existentes = await obterPreferenciasExistentes();

    addLog(`ℹ️ Encontradas ${existentes.size} preferências cadastradas na Unidade.`, 'info');



    // Pré-carrega tabela oficial de classificações cadastradas na Unidade

    if (cacheClassificacoesUnidade.size === 0) {

      addLog('🏷️ Mapeando classificações de minutas cadastradas na Unidade...', 'info');

      await carregarTodasClassificacoesDaTabela();

      const totalClassifsUnicas = new Set(Array.from(cacheClassificacoesUnidade.values()).map(item => item.id)).size;

      addLog(`✓ ${totalClassifsUnicas} classificação(ões) encontrada(s) na Unidade.`, 'info');

    }



    // Pré-carrega catálogo completo de modelos da Unidade se ainda não mapeado

    if (poolGlobalModelos.size === 0) {

      addLog('📚 Mapeando catálogo de modelos de documentos da Unidade...', 'info');

      await escanearModelosDaUnidade(st.itens, (at, tot, desc) => {

        const sub = document.getElementById('rito-prog-subtext');

        if (sub) {

          sub.style.display = 'block';

          sub.textContent = `Mapeando modelos (${at}/${tot}): ${desc}`;

        }

      });

      addLog(`✓ Catálogo da Unidade pronto: ${poolGlobalModelos.size} modelo(s) mapeado(s).`, 'info');

    }

    }



    while (!window._eprocPararLote && st.idx < st.total) {

      const item = st.itens[st.idx];

      const pos = st.idx + 1;

      const pct = Math.round((pos / st.total) * 100);



      // REGRA 2: Exibe o formato "1/10, 2/10, 3/10..."

      const progText = document.getElementById('rito-prog-text');

      const progBar = document.getElementById('rito-prog-bar');

      const progSub = document.getElementById('rito-prog-subtext');

      if (progText) progText.textContent = `${pos} / ${st.total} (${pct}%)`;

      if (progBar) {

        progBar.style.width = Math.max(5, pct) + '%';

        progBar.classList.add('rito-progress-active');

      }

      if (progSub) {
        progSub.style.display = 'block';
        const numTxt = (item.num !== undefined && item.num !== null && String(item.num).trim() !== '' && String(item.num).trim() !== 'undefined')
          ? String(item.num).trim()
          : String(item.linha || st.idx);
        progSub.textContent = `Processando #${numTxt}: ${item.nome}`;
      }



      // REGRA 6: Se já existe preferência de mesmo nome na Unidade, pula e contabiliza em Puladas
      if (preferenciaJaExiste(item.nome, existentes)) {
        totalPuladas++;
        renderizarLogCardSkipped(item, 'Essa preferência já existe na unidade');
        st.idx++;
        saveState(st);
        await sleep(150);
        continue;
      }



      // Executa os 13 passos para criar a preferência

      try {

        const dados = await executarPassoAPassoItem(item);

        totalCriadas++;

        existentes.add(item.nome);
        existentes.add(normalizar(item.nome));



        // REGRA 5: Registra ocorrências onde localizadores default (ARQUIVO / BAIXADOS) foram usados

        if (dados.locPrincipalFallback || dados.locSecundariosFallback) {

          listaFallbacks.push({

            linha: item.linha,

            nome: item.nome,

            principal: dados.locPrincipalFallback ? ((item.localizadores && item.localizadores[0]) || item.localizador || 'Não informado') : null,

            secundarios: dados.locSecundariosFallback ? ((item.localizadores && item.localizadores.slice(1).join(', ')) || 'Não informado') : null

          });

        }



        // REGRA 3 e 4: Renderiza card visual completo com todos os dados inseridos

        ultimoSalvamentoMs = Date.now();

        renderizarLogCard(dados);

      } catch (err) {

        if (err.message === 'PARADA_SOLICITADA' || window._eprocPararLote) {

          addLog('⏹️ Execução interrompida pelo usuário.', 'warn');

          break;

        }

        const msgErrRaw = String(err.message || '');
        const msgErrNorm = normalizar(msgErrRaw);
        if (msgErrRaw.includes('DUPLICADA') || msgErrNorm.includes('ja existe') || msgErrNorm.includes('mesma descricao') || msgErrRaw.includes('u00e1 existe') || msgErrRaw.includes('mesma descri')) {

          totalPuladas++;

          existentes.add(item.nome);

          renderizarLogCardSkipped(item, 'Essa preferência já existe na unidade');

        } else {

          renderizarLogCardErro(item, err.message);

        }

      }



      if (window._eprocPararLote) break;



      st.idx++;

      saveState(st);



      // Intervalo entre itens

      await sleep(1000);

    }



    execucaoLoteAtiva = false;

    gravacaoEmAndamento = false;



    // REGRA 1: Restaura botão de parada

    const btnParar = document.getElementById('btn-rito-parar');

    if (btnParar) {

      btnParar.disabled = false;

      btnParar.innerHTML = '<span>🛑</span> !Parar execução';

      btnParar.style.display = 'none';

    }

    const btnIniciar = document.getElementById('btn-rito-iniciar');

    if (btnIniciar) btnIniciar.style.display = 'flex';



    const progBarFim = document.getElementById('rito-prog-bar');

    if (progBarFim) progBarFim.classList.remove('rito-progress-active');

    const progLabelFim = document.getElementById('rito-prog-label');

    if (progLabelFim) progLabelFim.textContent = 'Progresso:';

    const progSubFim = document.getElementById('rito-prog-subtext');

    if (progSubFim) {

      progSubFim.style.display = 'block';

      progSubFim.textContent = window._eprocPararLote ? '⏹️ Execução interrompida pelo usuário.' : '✅ Lote finalizado!';

    }



    // REGRA 5: Exibe o resumo final com eventual fallback e total de classificações criadas

    const fimLoteMs = ultimoSalvamentoMs || Date.now();

    const tempoExecucaoStr = formatarTempoExecucao(fimLoteMs - inicioLoteMs, new Date(inicioLoteMs), new Date(fimLoteMs));

    let tempoGeralStr = '';

    if (st.inicioAuditoriaMs && st.inicioAuditoriaMs < inicioLoteMs) {

      tempoGeralStr = formatarTempoExecucao(fimLoteMs - st.inicioAuditoriaMs, new Date(st.inicioAuditoriaMs), new Date(fimLoteMs));

    }



    renderizarResumoFinal(st.idx, st.total, totalCriadas, totalPuladas, listaFallbacks, totalClassificacoesCriadasNoLote, tempoExecucaoStr, tempoGeralStr);



    addLog(`=== RESUMO DA EXECUÇÃO ===`);

    addLog(`• Total processado: ${st.idx} de ${st.total} preferências`);

    addLog(`• Criadas com sucesso: ${totalCriadas}`);

    addLog(`• Puladas (já existentes): ${totalPuladas}`);

    addLog(`• Classificações criadas: ${totalClassificacoesCriadasNoLote}`);

    addLog(`• Tempo de execução (desde as verificações preliminares até a última gravação): ${tempoExecucaoStr}`);

    if (tempoGeralStr) {

      addLog(`• Tempo total (incluindo a Verificação Prévia de Auditoria): ${tempoGeralStr}`);

    }

    if (listaFallbacks.length === 0) {

      addLog('✅ Todos os localizadores usados foram encontrados na unidade.', 'success');

    }



    // RESTAURAÇÃO TOTAL DA TELA INICIAL DE "NOVA MINUTA" NO EPROC

    await restaurarTelaInicialEproc();

    if (!window._eprocPararLote && st.idx >= st.total) {
      clearState();
    }
  }



  /* ================== GERENCIAMENTO E EXCLUSÃO DE PREFERÊNCIAS ================== */

  function obterUrlGerenciador() {

    const btnLista = document.getElementById('listaPreferencias');

    if (!btnLista) return null;

    const onclickAttr = btnLista.getAttribute('onclick') || '';

    const match = onclickAttr.match(/exibirSubFrm\('([^']+)'/);

    if (!match || !match[1]) return null;

    return match[1].replace(/&amp;/g, '&');

  }



  async function obterTodasPreferenciasUnidade() {

    const mapItens = new Map();



    // 1. Fonte Primária: Tabela HTML completa do Gerenciador de preferências

    const urlGerenciador = obterUrlGerenciador();

    if (urlGerenciador) {

      try {

        const resp = await fetch(urlGerenciador, { credentials: 'same-origin' });

        if (resp.ok) {

          const html = await resp.text();

          const parser = new DOMParser();

          const doc = parser.parseFromString(html, 'text/html');

          doc.querySelectorAll('input[name="chkInfraItem[]"]').forEach(chk => {

            const id = (chk.value || '').trim();

            const tr = chk.closest('tr');

            if (id && tr) {

              let rawNome = '';

              if (tr.cells && tr.cells.length > 2) {

                rawNome = tr.cells[2].textContent.trim();

              }

              if (!rawNome) {

                const tdDesc = tr.querySelector('td:nth-child(3)') || tr.querySelector('td:nth-child(2)');

                rawNome = tdDesc ? tdDesc.textContent.trim() : '';

              }

              const nome = decodificarEntidadesHtml(decodeEntities(rawNome)).trim();

              if (id && nome) mapItens.set(id, { id, nome });

            }

          });

        }

      } catch (e) {

        console.warn('Erro ao consultar tabela do gerenciador de preferências:', e);

      }

    }



    // 2. Fonte Complementar / Oficial: Autocomplete do eproc (XML)

    let urlAutoComp = (window.objAjaxAutoCompPreferencia && (window.objAjaxAutoCompPreferencia.ajaxTarget || window.objAjaxAutoCompPreferencia.urlServico));
    if (!urlAutoComp) {
      const scripts = document.querySelectorAll('script:not([src])');
      for (const s of scripts) {
        const txt = s.textContent || '';
        const m = txt.match(/['"](controlador_ajax\.php\?acao_ajax=preferencia_auto_completar[^'"]+)['"]/i);
        if (m && m[1]) {
          urlAutoComp = m[1].replace(/&amp;/g, '&');
          break;
        }
      }
    }

    if (urlAutoComp) {

      try {

        const resp = await fetch(urlAutoComp, { credentials: 'same-origin' });

        if (resp.ok) {

          const txt = await resp.text();

          const parser = new DOMParser();

          const xml = parser.parseFromString(txt, 'text/xml');

          xml.querySelectorAll('item').forEach(it => {

            const id = (it.getAttribute('id') || '').trim();

            const rawDesc = (it.getAttribute('descricao') || it.textContent || '').trim();

            const desc = decodificarEntidadesHtml(decodeEntities(rawDesc)).trim();

            if (id && desc) {

              mapItens.set(id, { id, nome: desc });

            }

          });



          if (mapItens.size === 0) {

            const regex = /<item\s+[^>]*id=["']([^"']+)["'][^>]*descricao=["']([^"']+)["']/gi;

            let m;

            while ((m = regex.exec(txt)) !== null) {

              const id = m[1].trim();

              const desc = decodificarEntidadesHtml(decodeEntities(m[2])).trim();

              if (id && desc) {

                mapItens.set(id, { id, nome: desc });

              }

            }

          }

        }

      } catch (e) {

        console.warn('Erro ao consultar XML de autocompletar preferências:', e);

      }

    }



    // 3. Fonte em memória: arrItens

    if (window.objAjaxAutoCompPreferencia && Array.isArray(window.objAjaxAutoCompPreferencia.arrItens)) {

      window.objAjaxAutoCompPreferencia.arrItens.forEach(it => {

        const id = String(it.id || '').trim();

        const rawNome = String(it.descricao || it.text || it.value || '').trim();

        const nome = decodificarEntidadesHtml(decodeEntities(rawNome)).trim();

        if (id && nome && !mapItens.has(id)) {

          mapItens.set(id, { id, nome });

        }

      });

    }



    return Array.from(mapItens.values());

  }



  async function obterParametrosFormGerenciador() {

    const urlListar = obterUrlGerenciador();

    let actionUrl = urlListar;

    const formFields = {};



    if (urlListar) {

      try {

        const resp = await fetch(urlListar, { credentials: 'same-origin' });

        if (resp.ok) {

          const html = await resp.text();

          const parser = new DOMParser();

          const doc = parser.parseFromString(html, 'text/html');

          const form = doc.querySelector('form[action*="formulario_personalizacao" i]') || doc.forms[0];

          if (form) {

            actionUrl = form.getAttribute('action') ? form.getAttribute('action').replace(/&amp;/g, '&') : urlListar;

            form.querySelectorAll('input[type="hidden"]').forEach(inp => {

              if (inp.name) formFields[inp.name] = inp.value;

            });

          }

        }

      } catch (e) {

        console.warn('Erro ao obter formulário do gerenciador:', e);

      }

    }

    return { actionUrl, formFields };

  }



  /* ================== CACHE E BUSCA DE EVENTOS ================== */

  const cacheEventosPorTermo = {};



  async function obterEventosPorTermo(termoBusca) {

    const termo = (termoBusca || '').trim();

    if (!termo) return [];

    const chave = termo.toUpperCase();

    if (cacheEventosPorTermo[chave] && cacheEventosPorTermo[chave].length > 0) {

      return cacheEventosPorTermo[chave];

    }



    const lista = [];

    const url = (window.objAjaxAutoCompEvento && (window.objAjaxAutoCompEvento.ajaxTarget || window.objAjaxAutoCompEvento.urlServico)) || window.mc_strLinkAjaxEvento;



    if (url) {

      try {

        const resp = await fetch(url, {

          method: 'POST',

          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },

          body: 'particula=' + encodeURIComponent(termo),

          credentials: 'same-origin'

        });

        if (resp.ok) {

          const txt = await lerRespostaTexto(resp);

          const parser = new DOMParser();

          const xml = parser.parseFromString(txt, 'text/xml');

          xml.querySelectorAll('item').forEach(it => {

            const id = it.getAttribute('id') || '';

            const desc = it.getAttribute('descricao') || it.textContent || '';

            const compl = it.getAttribute('complemento') || '';

            if (id && desc) {

              lista.push({ id, descricao: desc.trim(), complemento: compl });

            }

          });



          if (lista.length === 0) {

            const re = /<item\s+[^>]*id=["']([^"']+)["'][^>]*descricao=["']([^"']+)["'](?:[^>]*complemento=["']([^"']*)["'])?/gi;

            let m;

            while ((m = re.exec(txt)) !== null) {

              lista.push({ id: m[1], descricao: m[2].trim(), complemento: m[3] || '' });

            }

          }

        }

      } catch (e) {

        console.warn('Erro ao consultar eventos via fetch para termo ' + termo, e);

      }

    }



    if (lista.length > 0) {

      cacheEventosPorTermo[chave] = lista;

    }

    return lista;

  }



  /* ================== DIAGNÓSTICO PRÉ-VOO (AUDITORIA ANTES DA EXECUÇÃO) ================== */

  function obterOuCriarModalOverlay() {

    let overlay = document.getElementById('eproc-pref-modal-overlay');

    if (!overlay) {

      overlay = document.createElement('div');

      overlay.id = 'eproc-pref-modal-overlay';

      (document.body || document.documentElement).appendChild(overlay);

    }

    return overlay;

  }



  function exibirModalDiagnosticoCarregando() {

    // A barra de progresso agora é integrada diretamente no painel do script

  }



  function atualizarProgressoDiagnostico(pct, textoDireita, mensagem, ativo = true) {

    const wrap = document.getElementById('rito-prog-wrap');

    const label = document.getElementById('rito-prog-label');

    const bar = document.getElementById('rito-prog-bar');

    const text = document.getElementById('rito-prog-text');

    const subtext = document.getElementById('rito-prog-subtext');

    const btnDiag = document.getElementById('btn-rito-diagnostico');



    const pctClamped = Math.max(0, Math.min(100, Math.round(pct)));

    if (wrap) wrap.style.display = 'block';

    if (label) {

      label.textContent = ativo ? 'Verificando na Unidade:' : '✅ Verificação:';

    }

    if (bar) {

      bar.style.width = Math.max(ativo ? 6 : 0, pctClamped) + '%';

      if (ativo) bar.classList.add('rito-progress-active');

      else bar.classList.remove('rito-progress-active');

    }

    if (text) text.textContent = `${textoDireita} (${pctClamped}%)`;

    if (subtext) {

      subtext.style.display = 'block';

      subtext.textContent = mensagem;

    }

    if (btnDiag && ativo) {

      btnDiag.innerHTML = `<span>⏳</span> Verificando (${pctClamped}%)...`;

    }

  }




  /* ================== MÓDULO 4: ÁREA DE TRABALHO DE MINUTAS (DOCUMENTOS) ================== */

  async function obterPreferenciaAreaMinutasExistentes() {
    const existentes = new Set();
    const mapaIds = new Map();

    const registrarPref = (descBruta, id) => {
      if (!descBruta) return;
      const descLimpa = decodificarEntidadesHtml(descBruta).trim();
      if (!descLimpa || descLimpa.length < 2) return;
      existentes.add(descLimpa);
      const norm = normalizar(descLimpa);
      if (norm) existentes.add(norm);
      if (id) {
        mapaIds.set(norm, String(id));
        mapaIds.set(descLimpa, String(id));
      }
    };

    // 0. Usa a rotina unificada (gerenciador #listaPreferencias + XML do autocomplete com hash da ação)
    try {
      const listaUnidade = await obterTodasPreferenciasUnidade();
      if (Array.isArray(listaUnidade)) {
        listaUnidade.forEach(item => {
          if (item && item.nome) registrarPref(item.nome, item.id);
        });
      }
    } catch (eUnid) {}

    // 1. Verifica se o autocomplete já tem itens na memória (objAjaxAutoCompPreferencia.arrItens)
    try {
      if (window.objAjaxAutoCompPreferencia && Array.isArray(window.objAjaxAutoCompPreferencia.arrItens)) {
        window.objAjaxAutoCompPreferencia.arrItens.forEach(it => {
          registrarPref(it.descricao || it.label || it.value, it.id);
        });
      }
    } catch (eObj) {}

    // 2. Consulta o autocomplete endpoint extraindo a URL exata (com hash próprio da ação) dos scripts da página
    try {
      let urlAuto = (window.objAjaxAutoCompPreferencia && (window.objAjaxAutoCompPreferencia.ajaxTarget || window.objAjaxAutoCompPreferencia.urlServico)) || '';
      if (!urlAuto) {
        const m = document.documentElement.innerHTML.match(/['"](controlador_ajax\.php\?acao_ajax=preferencia_auto_completar[^'"]+)['"]/i);
        if (m && m[1]) urlAuto = m[1].replace(/&amp;/g, '&');
      }
      if (urlAuto) {
        const res = await fetch(urlAuto, {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: 'txtPreferencia='
        });
        if (res.ok) {
          const txt = await res.text();
          if (txt && txt.length > 5) {
            const regexItem = /<item\s+[^>]*id=["']([^"']+)["'][^>]*descricao=["']([^"']+)["']/gi;
            let mIt;
            while ((mIt = regexItem.exec(txt)) !== null) {
              registrarPref(mIt[2], mIt[1]);
            }
            const doc = new DOMParser().parseFromString(txt, 'text/html');
            doc.querySelectorAll('item, li, tr, td, a').forEach(el => {
              const t = el.getAttribute('descricao') || (el.textContent || '').trim();
              const id = el.getAttribute('id') || el.getAttribute('data-id') || '';
              if (t && t.length > 2) registrarPref(t, id);
            });
          }
        }
      }
    } catch (eAuto) {}

    window._eprocMapaPreferenciasAreaMinutas = mapaIds;
    return existentes;
  }

  async function executarDiagnosticoPreVooAreaMinutas() {
    if (!itensCarregados || itensCarregados.length === 0) {
      alertOriginal.call(window, 'Carregue primeiro a planilha unificada antes de executar a Verificação prévia.');
      return;
    }

    const btnDiag = document.getElementById('btn-rito-diagnostico');
    const btnIni = document.getElementById('btn-rito-iniciar');
    if (btnDiag) {
      btnDiag.disabled = true;
      btnDiag.classList.add('rito-diagnostico-ativo');
      btnDiag.innerHTML = '<span>⏳</span> Verificando (0%)...';
    }
    if (btnIni) btnIni.disabled = true;

    try {
      addLog('🔍 Iniciando Verificação prévia: Módulo Documentos / Área de Minutas...', 'info');
      atualizarProgressoDiagnostico(15, 'Etapa 1/3', '1. Verificando Localizadores da Unidade...', true);
      await sleep(80);

      // Etapa 1: Localizadores da Unidade (#selLocalizador)
      const selLoc = document.getElementById('selLocalizador');
      const locsDisponiveis = [];
      const mapaLocs = new Map();
      if (selLoc && selLoc.options) {
        Array.from(selLoc.options).forEach(opt => {
          const val = (opt.value || '').trim();
          const txt = (opt.text || '').trim();
          if (val && val !== 'null' && !txt.includes('Desmarcar Todos')) {
            locsDisponiveis.push({ valor: val, texto: txt });
            mapaLocs.set(normalizar(txt), val);
          }
        });
      }
      addLog(`✓ ${locsDisponiveis.length} localizador(es) encontrados na Área de Minutas.`);

      // Identifica localizadores da planilha ausentes
      const locsNaoEncontrados = new Set();
      itensCarregados.forEach(it => {
        const l = (it.localizador || '').trim();
        if (l && l !== '-') {
          const optLoc = acharOpcaoLocalizador(selLoc, l, false) || acharOpcaoLocalizador(selLoc, l, true);
          if (!optLoc) locsNaoEncontrados.add(l);
        }
      });

      // Etapa 2: Grupos de Preferências
      atualizarProgressoDiagnostico(55, 'Etapa 2/3', '2. Verificando Grupos de Preferências...', true);
      await sleep(80);
      const gruposPlanilha = new Set();
      itensCarregados.forEach(it => {
        const g = (it.grupo || '').trim();
        if (g && g !== '-') gruposPlanilha.add(g);
      });
      addLog(`📁 Identificando grupos de preferências da planilha (${gruposPlanilha.size} grupo(s))...`);

      const gruposCadastrados = await obterGruposCadastradosNoEproc2G();
      const gruposNovos = [];
      const gruposMapeados = [];
      for (const g of gruposPlanilha) {
        const normG = normalizar(g);
        if (gruposCadastrados.has(normG)) {
          gruposMapeados.push(g);
        } else {
          gruposNovos.push(g);
        }
      }
      addLog(`✓ Grupos da planilha: ${gruposMapeados.length} mapeados (${gruposNovos.length} novos a serem criados no eproc).`);

      // Etapa 3: Preferências já salvas na Unidade
      atualizarProgressoDiagnostico(85, 'Etapa 3/3', '3. Consultando preferências já salvas na Unidade...', true);
      await sleep(80);
      addLog('📋 Consultando preferências já salvas na Unidade...');
      const prefsExistentes = await obterPreferenciaAreaMinutasExistentes();
      const duplicadas = [];
      const novas = [];
      itensCarregados.forEach(it => {
        if (preferenciaJaExiste(it.nome, prefsExistentes)) {
          duplicadas.push(it.nome);
        } else {
          novas.push(it.nome);
        }
      });
      addLog(`✓ ${duplicadas.length} preferência(s) existentes localizadas na Unidade.`);

      atualizarProgressoDiagnostico(100, 'Concluído', 'Verificação prévia de Documentos concluída!', false);

      addLog('=== RELATÓRIO DA VERIFICAÇÃO PRÉVIA (DOCUMENTOS / ÁREA DE MINUTAS) ===');
      addLog(`• Total de preferências na planilha: ${itensCarregados.length}`);
      addLog(`• Grupos mapeados: ${gruposPlanilha.size} (${gruposNovos.length} serão criados automaticamente)`);
      if (gruposNovos.length > 0) {
        addLog(`  ↳ Novos grupos: ${gruposNovos.join(', ')}`);
      }
      addLog(`• Preferências já existentes na Unidade: ${duplicadas.length}${duplicadas.length > 0 ? ' (serão puladas automaticamente)' : ''}`);
      addLog(`• Preferências novas a criar: ${novas.length}`);

      if (locsNaoEncontrados.size > 0) {
        addLog(`⚠️ Atenção: Localizadores da planilha não encontrados nesta Unidade: ${Array.from(locsNaoEncontrados).join(', ')}`, 'warn');
      }

      addLog('✅ Auditoria de integridade concluída com sucesso!', 'success');

    } catch (e) {
      addLog(`❌ Falha durante a Verificação prévia da Área de Minutas: ${e.message}`, 'error');
      atualizarProgressoDiagnostico(100, 'Falha', 'Erro na verificação: ' + (e.message || e), false);
    } finally {
      if (btnDiag) {
        btnDiag.disabled = false;
        btnDiag.classList.remove('rito-diagnostico-ativo');
        btnDiag.innerHTML = '<span>🔍</span> Verificação prévia';
      }
      if (btnIni) btnIni.disabled = false;
    }
  }

  function sincronizarMultipleSelectAreaMinutas(selectEl, valoresDesejados) {
    if (!selectEl) return [];
    const idSel = selectEl.id;
    const setVals = new Set(
      (valoresDesejados || [])
        .map(v => String(v || '').trim())
        .filter(v => v && v !== 'null')
    );
    const textosSelecionados = [];
    const todosValoresValidos = [];

    Array.from(selectEl.options || []).forEach(opt => {
      const val = String(opt.value || '').trim();
      if (!val || val === 'null') {
        opt.selected = false;
        opt.removeAttribute('selected');
        return;
      }
      todosValoresValidos.push(val);
      if (setVals.has(val)) {
        opt.selected = true;
        textosSelecionados.push((opt.text || '').trim());
      } else {
        opt.selected = false;
        opt.removeAttribute('selected');
      }
    });

    const arrVals = Array.from(setVals);

    // 1. Atualiza via plugin multipleSelect do jQuery (nunca usando checkAll para não marcar value="null" [Desmarcar Todos])
    const jq = window.jQuery || window.$;
    if (jq && typeof jq.fn.multipleSelect === 'function') {
      try {
        jq('#' + idSel).multipleSelect('setSelects', arrVals);
        const inpNull = document.querySelector(`input[name="selectItem${idSel}[]"][value="null"]`);
        if (inpNull && inpNull.checked) {
          inpNull.checked = false;
          const liNull = inpNull.closest('li');
          if (liNull) liNull.classList.remove('selected');
        }
      } catch (eMs) {}
    }

    // 2. Garante sincronia visual direta no DOM do .ms-parent (checkboxes, classes .selected e texto do botão .ms-choice)
    const msParent = (selectEl.nextElementSibling && selectEl.nextElementSibling.classList.contains('ms-parent'))
      ? selectEl.nextElementSibling
      : (selectEl.parentElement ? selectEl.parentElement.querySelector('.ms-parent') : null);

    if (msParent) {
      const itemCheckboxes = msParent.querySelectorAll(`input[name="selectItem${idSel}[]"]`);
      itemCheckboxes.forEach(cb => {
        const val = String(cb.value || '').trim();
        const deveMarcar = Boolean(val && val !== 'null' && setVals.has(val));
        cb.checked = deveMarcar;
        const li = cb.closest('li');
        if (li) {
          if (deveMarcar) li.classList.add('selected');
          else li.classList.remove('selected');
        }
        const lbl = cb.closest('label');
        if (lbl && lbl.style && lbl.style.display === 'none') {
          lbl.style.display = '';
        }
      });

      const selectAllCb = msParent.querySelector(`input[name="selectAll${idSel}[]"]`);
      if (selectAllCb) {
        selectAllCb.checked = (todosValoresValidos.length > 0 && arrVals.length === todosValoresValidos.length);
      }

      const spanChoice = msParent.querySelector('.ms-choice > span');
      if (spanChoice) {
        if (textosSelecionados.length === 0) {
          spanChoice.classList.add('placeholder');
          spanChoice.textContent = '';
        } else {
          spanChoice.classList.remove('placeholder');
          if (todosValoresValidos.length > 0 && arrVals.length === todosValoresValidos.length) {
            spanChoice.textContent = 'Todos selecionados';
          } else if (textosSelecionados.length === 1) {
            spanChoice.textContent = textosSelecionados[0];
          } else {
            spanChoice.textContent = `${textosSelecionados.length} de ${todosValoresValidos.length + 1} selecionados`;
          }
        }
      }
    }

    dispararEventos(selectEl, ['change']);
    return arrVals;
  }

  function resolverOpcoesTipoDocumentoAreaMinutas(selTipoDoc, textoPlanilha) {
    if (!selTipoDoc || !textoPlanilha || textoPlanilha.trim() === '-') return [];
    const rawTermos = textoPlanilha.split(/[;,]+/).map(s => normalizar(s.trim())).filter(Boolean);
    if (rawTermos.length === 0) return [];

    // Corrige eventuais erros de digitação na planilha (ex: "voto digergente" -> "voto divergente")
    const termos = rawTermos.map(t => t.replace(/\bdigergente\b/g, 'divergente'));
    const opcoesValidas = Array.from(selTipoDoc.options || []).filter(o => o.value && o.value !== 'null');
    const valoresEscolhidos = new Set();

    termos.forEach(termo => {
      // 1. Casamento exato de nome normalizado (ex: "voto", "voto revisao", "voto complementar", "voto divergente", "despacho decisao")
      const exatos = opcoesValidas.filter(o => normalizar(o.text) === termo);
      if (exatos.length > 0) {
        exatos.forEach(o => valoresEscolhidos.add(o.value));
        return;
      }

      // 2. Caso especial do eproc 2G: "DECISÃO" ou "DESPACHO" isolados correspondem a "DESPACHO/DECISÃO" (value="1")
      if (termo === 'decisao' || termo === 'decisoes' || termo === 'despacho' || termo === 'despachos' || termo === 'despacho decisao') {
        const optDespDec = opcoesValidas.find(o => normalizar(o.text) === 'despacho decisao' || o.value === '1');
        if (optDespDec) {
          valoresEscolhidos.add(optDespDec.value);
          return;
        }
      }

      // 3. Fallback: casamento por palavra/expressão contida
      opcoesValidas.forEach(o => {
        const tNorm = normalizar(o.text);
        if (tNorm === termo || tNorm.includes(termo)) {
          valoresEscolhidos.add(o.value);
        }
      });
    });

    return Array.from(valoresEscolhidos);
  }

  async function salvarPreferenciaAreaMinutasViaPaginaNativa(frm, item, idGrupo) {
    // Reproduz o fluxo nativo: Consultar (POST) -> página real com validarPreferencias -> Salvar preferência
    const resultado = { ok: false, msg: '', duplicada: false };
    const nomeIframe = 'eproc-pref-iframe-' + Date.now();
    const iframe = document.createElement('iframe');
    iframe.name = nomeIframe;
    iframe.style.cssText = 'position:fixed;left:-99999px;top:0;width:1200px;height:800px;opacity:0;pointer-events:none;';
    document.body.appendChild(iframe);
    const formTmp = document.createElement('form');
    try {
      formTmp.method = 'POST';
      formTmp.action = frm.action;
      formTmp.target = nomeIframe;
      formTmp.acceptCharset = 'UTF-8';
      formTmp.style.display = 'none';
      const fd = new FormData(frm);
      for (const [k, v] of fd.entries()) {
        if (typeof v !== 'string') continue;
        if (v === 'null' && /^(selTipoDocumento|selStatusMinuta|selLocalizador)\[\]$/.test(k)) continue;
        const inp = document.createElement('input');
        inp.type = 'hidden';
        inp.name = k;
        inp.value = (k === 'hdnConsultaNormal') ? 'true' : (k === 'solr_forcar_pesquisa' ? 'N' : v);
        formTmp.appendChild(inp);
      }
      document.body.appendChild(formTmp);

      const carregou = new Promise(res => { iframe.addEventListener('load', () => res(true), { once: true }); setTimeout(() => res(false), 30000); });
      formTmp.submit();
      if (!(await carregou)) { resultado.msg = 'Tempo esgotado carregando a consulta da Área de Minutas.'; return resultado; }
      await sleep(1500);

      const w = iframe.contentWindow;
      const d = iframe.contentDocument;
      if (!w || !d) { resultado.msg = 'Não foi possível acessar a página de consulta.'; return resultado; }
      if (typeof w.validarPreferencias !== 'function') {
        resultado.msg = 'A página de consulta não disponibilizou a função validarPreferencias (preferências indisponíveis).';
        return resultado;
      }

      const mensagens = [];
      w.alert = function (m) { mensagens.push(String(m || '')); };
      w.confirm = function () { return true; };
      w.onbeforeunload = null;

      try { if (typeof w.exibirFormPreferencias === 'function') w.exibirFormPreferencias('salvar'); } catch (e) {}
      const hdnAcao = d.getElementById('hdnAcaoPreferencia'); if (hdnAcao) hdnAcao.value = 'salvar';
      const txtDesc = d.getElementById('txtDescricaoCadastro');
      if (!txtDesc) { resultado.msg = 'Campo de descrição da preferência não encontrado.'; return resultado; }
      txtDesc.disabled = false;
      txtDesc.value = item.nome;
      const rdU = d.querySelector('input[name="rdPrefTipo"][value="U"]');
      if (rdU) { rdU.disabled = false; rdU.checked = true; }
      const chkPad = d.getElementById('chkValorPadrao'); if (chkPad) chkPad.checked = false;
      const chkPainel = d.getElementById('chkPainelInicial'); if (chkPainel) chkPainel.checked = false;
      const selG = d.getElementById('selFormularioPersonalizacaoGrupo');
      if (selG) {
        selG.disabled = false;
        if (idGrupo && idGrupo !== 'null') {
          let o = Array.from(selG.options).find(x => x.value === idGrupo);
          if (!o) { o = d.createElement('option'); o.value = idGrupo; o.text = item.grupo || idGrupo; selG.appendChild(o); }
          selG.value = idGrupo;
        }
      }

      const btn = d.getElementById('btnOK');
      if (btn) btn.click(); else w.validarPreferencias();

      let esperou = 0;
      while (esperou < 15000) {
        await sleep(300); esperou += 300;
        const msg = mensagens.join(' | ');
        const n = normalizar(msg);
        if (n.includes('cadastrada') || n.includes('atualizada')) { resultado.ok = true; resultado.msg = msg; return resultado; }
        if (n.includes('ja existe') || n.includes('mesma descricao')) { resultado.duplicada = true; resultado.msg = msg; return resultado; }
        if (mensagens.length > 0) { resultado.msg = msg; return resultado; }
      }
      resultado.msg = 'Sem resposta do eproc ao salvar a preferência.';
      return resultado;
    } catch (e) {
      resultado.msg = 'Falha no salvamento nativo: ' + (e && e.message ? e.message : e);
      return resultado;
    } finally {
      try { formTmp.remove(); } catch (e) {}
      try { iframe.remove(); } catch (e) {}
    }
  }

  async function obterOrgaoProprietarioDaLotacaoCabecalho() {
    let sigla = '';
    let idOrgao = '';

    // 1. Extrai o nome/sigla da unidade diretamente da lotação expressa no cabeçalho (#selInfraUnidades)
    const selLotacao = document.getElementById('selInfraUnidades') ||
                       document.querySelector('select.selInfraUnidades, .frm-lotacoes select');
    if (selLotacao) {
      const optSel = (selLotacao.selectedIndex >= 0 ? selLotacao.options[selLotacao.selectedIndex] : null) ||
                     selLotacao.querySelector('option[selected]');
      if (optSel) {
        const txtLot = (optSel.textContent || optSel.innerText || '').trim();
        if (txtLot.includes('/')) {
          sigla = txtLot.split('/')[0].trim();
        } else if (txtLot) {
          sigla = txtLot;
        }
        if (!sigla && optSel.title && optSel.title.includes('/')) {
          const antesBarra = optSel.title.split('/')[0].trim();
          const partesTraco = antesBarra.split(' - ');
          sigla = partesTraco[partesTraco.length - 1].trim();
        }
      }
    }

    // 2. Extrai o ID interno do órgão proprietário (e fallback da sigla) dos scripts nativos da página (limparFiltros / esconderClassificacaoEDescricao)
    const htmlFontes = [
      typeof window.limparFiltros === 'function' ? window.limparFiltros.toString() : '',
      typeof window.esconderClassificacaoEDescricao === 'function' ? window.esconderClassificacaoEDescricao.toString() : '',
      document.documentElement ? document.documentElement.innerHTML : ''
    ].join('\n');

    if (!sigla) {
      const mSigla = htmlFontes.match(/texOrgaoProprietario['"]\)\.(?:html|val|text)\(\s*['"]([^'"]+)['"]\s*\)/i);
      if (mSigla && mSigla[1] && normalizar(mSigla[1]) !== 'todos') {
        sigla = mSigla[1].trim();
      }
    }

    const mIdLimpar = htmlFontes.match(/hdnIdOrgaoProprietario['"]\)\.val\(\s*['"]([^'"]+)['"]\s*\)/i);
    if (mIdLimpar && mIdLimpar[1] && mIdLimpar[1] !== 'null') {
      idOrgao = mIdLimpar[1].trim();
    }
    if (!idOrgao) {
      const mIdArr = htmlFontes.match(/arrOrgaos\[0\]\s*!==?\s*['"](\d+)['"]/i) ||
                     htmlFontes.match(/strOrgaoSelecionado\s*!==?\s*['"](\d+)['"]/i);
      if (mIdArr && mIdArr[1]) {
        idOrgao = mIdArr[1].trim();
      }
    }

    // 3. Fallback: lê do próprio #hdnIdOrgaoProprietario se já contiver um ID válido (diferente de 'null' / vazio)
    const hdnOrgaoEl = document.getElementById('hdnIdOrgaoProprietario');
    if (!idOrgao && hdnOrgaoEl) {
      const valAtual = (hdnOrgaoEl.value || hdnOrgaoEl.getAttribute('value') || '').trim();
      if (valAtual && valAtual !== 'null') {
        idOrgao = valAtual;
      }
    }

    // 4. Fallback adicional: consulta o subform de seleção de órgão (minuta_area_trabalho_subfrm_filtrar_orgao) buscando pela sigla da lotação
    if (sigla && !idOrgao) {
      const lblSelOrgao = document.getElementById('lblOrgaoSelecionar');
      const onclickOrgao = lblSelOrgao ? (lblSelOrgao.getAttribute('onclick') || '') : '';
      const mUrlOrgao = onclickOrgao.match(/exibirSubFrm\(\s*['"]([^'"]+)['"]/i);
      if (mUrlOrgao && mUrlOrgao[1]) {
        try {
          const respOrg = await fetch(mUrlOrgao[1].replace(/&amp;/g, '&'), { credentials: 'same-origin' });
          if (respOrg.ok) {
            const htmlOrg = await respOrg.text();
            const docOrg = new DOMParser().parseFromString(htmlOrg, 'text/html');
            const siglaNorm = normalizar(sigla);
            const inputsOrg = Array.from(docOrg.querySelectorAll('input[type="checkbox"], input[type="radio"], option'));
            for (const inp of inputsOrg) {
              const linhaTxt = normalizar((inp.closest('tr') ? inp.closest('tr').textContent : inp.parentElement ? inp.parentElement.textContent : inp.textContent) || '');
              const titleTxt = normalizar(inp.title || inp.getAttribute('title') || '');
              if ((linhaTxt && linhaTxt.includes(siglaNorm)) || (titleTxt && titleTxt.includes(siglaNorm))) {
                const v = (inp.value || '').trim();
                if (v && v !== 'null' && v !== 'on') {
                  idOrgao = v;
                  break;
                }
              }
            }
          }
        } catch (eOrg) {}
      }
    }

    return { sigla, idOrgao };
  }

  async function executarPassoAPassoAreaMinutas(item) {
    if (window._eprocPararLote) throw new Error('PARADA_SOLICITADA');
    gravacaoEmAndamento = true;

    addLog(`Configurando preferência de Documentos / Área de Minutas: "${item.nome}"...`);

    // 1. Garante grupo da preferência na unidade
    let idGrupo = 'null';
    if (item.grupo && item.grupo !== '-') {
      const resGrupo = await gerenciarGrupoPreferencia2G(item.grupo);
      if (resGrupo && resGrupo.id) {
        idGrupo = String(resGrupo.id);
      }
    }

    // 2. Identifica se a preferência já existe no eproc: se existir, pula como DUPLICADA
    let idExistente = null;
    if (window._eprocMapaPreferenciasAreaMinutas) {
      idExistente = window._eprocMapaPreferenciasAreaMinutas.get(normalizar(item.nome)) ||
                    window._eprocMapaPreferenciasAreaMinutas.get(item.nome.trim()) || null;
    }
    if (idExistente) {
      throw new Error('DUPLICADA: Essa preferência já existe na unidade');
    }

    // 3. Aplica os filtros na tela (#frmMinutaLista)
    // 3.0 Limpa estado residual de preferência anteriormente selecionada e restaura filtros padrão da tela
    try {
      if (typeof window.limparFiltros === 'function') {
        window.limparFiltros();
      }
    } catch (eLimp) {}

    ['txtPreferencia', 'hdnPreferencia', 'hdnPreferenciaUsuario', 'hdnNumIdValorSelecionadoCombo'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const frmLimpar = document.getElementById('frmMinutaLista');
    if (frmLimpar) {
      frmLimpar.querySelectorAll('input[name="isChangePreferencia"], input[name="hdnStrDescricaoPreferencia"], input[name="hdnStrPreferenciaUsuario"]').forEach(el => el.remove());
    }

    // 3.05 Preenche dinamicamente o Órgão Proprietário extraindo o nome da unidade da lotação no cabeçalho (#selInfraUnidades)
    const orgaoLotacao = await obterOrgaoProprietarioDaLotacaoCabecalho();
    const texOrgaoEl = document.getElementById('texOrgaoProprietario');
    const hdnOrgaoEl = document.getElementById('hdnIdOrgaoProprietario');
    if (texOrgaoEl && orgaoLotacao.sigla) {
      texOrgaoEl.value = orgaoLotacao.sigla;
      texOrgaoEl.textContent = orgaoLotacao.sigla;
    }
    if (hdnOrgaoEl && orgaoLotacao.idOrgao) {
      hdnOrgaoEl.value = orgaoLotacao.idOrgao;
    }
    try {
      if (typeof window.esconderClassificacaoEDescricao === 'function') window.esconderClassificacaoEDescricao();
      if (typeof window.exibirEsconderListarTodos === 'function') window.exibirEsconderListarTodos();
    } catch (eVis) {}

    // Garante que os blocos de filtros básicos e de localizador estejam visíveis
    const divFiltrosBasicos = document.getElementById('divFiltrosBasicos');
    if (divFiltrosBasicos && divFiltrosBasicos.style.display === 'none') {
      divFiltrosBasicos.style.display = 'block';
    }
    const divLocContainer = document.getElementById('divLocalizador');
    if (divLocContainer && divLocContainer.style.display === 'none') {
      divLocContainer.style.display = 'inline-block';
    }

    // 3.1 Tipo de Documento (#selTipoDocumento)
    const selTipoDoc = document.getElementById('selTipoDocumento');
    const valoresTipoDoc = resolverOpcoesTipoDocumentoAreaMinutas(selTipoDoc, item.tipoDocumento);
    const tiposSelecionados = sincronizarMultipleSelectAreaMinutas(selTipoDoc, valoresTipoDoc);
    const textosTiposSelecionados = selTipoDoc
      ? Array.from(selTipoDoc.options).filter(o => tiposSelecionados.includes(o.value)).map(o => o.text.trim())
      : [];

    // 3.2 Status da Minuta (#selStatusMinuta)
    const selStatus = document.getElementById('selStatusMinuta');
    const valoresStatus = [];
    let descStatusLog = '-';
    if (selStatus) {
      const rawStatus = (item.statusMinuta || '').trim();
      const normStatus = normalizar(rawStatus);
      if (!rawStatus || rawStatus === '-') {
        // Quando a planilha traz "-", deixa Status desmarcado (sem marcar [Desmarcar Todos])
        descStatusLog = '(Nenhum / Todos)';
      } else if (normStatus.includes('todas') || normStatus.includes('todos') || normStatus.includes('selecionar')) {
        Array.from(selStatus.options).forEach(opt => {
          if (opt.value && opt.value !== 'null') {
            valoresStatus.push(opt.value);
          }
        });
        descStatusLog = 'Todos selecionados';
      } else {
        const termosStatus = rawStatus.split(/[;,]+/).map(s => normalizar(s.trim())).filter(Boolean);
        const nomesSt = [];
        Array.from(selStatus.options).forEach(opt => {
          const tNorm = normalizar(opt.text);
          if (opt.value && opt.value !== 'null' && termosStatus.some(termo => tNorm === termo || tNorm.includes(termo))) {
            valoresStatus.push(opt.value);
            nomesSt.push(opt.text.trim());
          }
        });
        descStatusLog = nomesSt.join(', ') || rawStatus;
      }
    }
    const statusSelecionados = sincronizarMultipleSelectAreaMinutas(selStatus, valoresStatus);

    // 3.3 Localizador (#selLocalizador)
    const selLoc = document.getElementById('selLocalizador');
    const valoresLoc = [];
    let descLocLog = '(Qualquer / Não filtrado)';
    let locFallbackUsado = false;
    if (selLoc) {
      const rawLoc = (item.localizador || '').trim();
      if (rawLoc && rawLoc !== '-') {
        const partesLoc = rawLoc.split(/[;,]+/).map(s => s.trim()).filter(Boolean);
        const nomesLocEncontrados = [];
        partesLoc.forEach(desejado => {
          let optEncontrada = acharOpcaoLocalizador(selLoc, desejado, false);
          if (!optEncontrada) {
            optEncontrada = acharOpcaoLocalizador(selLoc, desejado, true);
          }
          if (optEncontrada && optEncontrada.value && optEncontrada.value !== 'null') {
            valoresLoc.push(optEncontrada.value);
            nomesLocEncontrados.push(optEncontrada.text.trim());
          }
        });

        if (valoresLoc.length === 0) {
          const optFallback = acharOpcaoLocalizador(selLoc, 'ARQUIVO - ARQUIVO', true) ||
                              acharOpcaoLocalizador(selLoc, 'BAIXADOS - BAIXADOS', true);
          if (optFallback && optFallback.value && optFallback.value !== 'null') {
            valoresLoc.push(optFallback.value);
            descLocLog = `⚠️ "${optFallback.text.trim()}" (Fallback: "${rawLoc}" não encontrado na Unidade)`;
            locFallbackUsado = true;
          } else {
            descLocLog = `⚠️ "${rawLoc}" (Não encontrado na Unidade)`;
          }
        } else {
          descLocLog = nomesLocEncontrados.join('; ');
        }
      }
    }
    const locsSelecionados = sincronizarMultipleSelectAreaMinutas(selLoc, valoresLoc);

    // 3.4 Usuário Criador (#txtUsuarioCriador / #hdnIdUsuarioCriador)
    const txtUser = document.getElementById('txtUsuarioCriador');
    const hdnUser = document.getElementById('hdnIdUsuarioCriador');
    const selUser = document.getElementById('selUsuarioCriador');
    const hdnSelUser = document.getElementById('hdnSelUsuarioCriador');
    const rawUsuario = (item.usuarioCriador && item.usuarioCriador !== '-') ? item.usuarioCriador.trim() : '';
    const ehPlaceholderUsuario = normalizar(rawUsuario).includes('matricula do servidor');
    const valUsuarioReal = ehPlaceholderUsuario ? '' : rawUsuario;
    if (txtUser) txtUser.value = valUsuarioReal;
    if (hdnUser) hdnUser.value = valUsuarioReal;
    if (selUser && !valUsuarioReal) selUser.innerHTML = '';
    if (hdnSelUser && !valUsuarioReal) hdnSelUser.value = '';

    // 3.45 Opções de salvamento lidas da coluna "Tipo de Preferência" (ex: "Unidade; Exibir no Painel Inicial")
    const normTipoPrefItem = normalizar(item.tipoPref || 'Unidade; Exibir no Painel Inicial');
    const rdPrefTipoVal = item.rdPrefTipo || ((normTipoPrefItem.includes('individual') && !normTipoPrefItem.includes('unidade')) ? 'I' : 'U');
    const chkPainelVal = (item.exibirPainel !== undefined ? item.exibirPainel : (normTipoPrefItem.includes('painel') || normTipoPrefItem.includes('exibir'))) ? 'S' : 'N';
    const chkPadraoVal = (item.marcarPadrao !== undefined ? item.marcarPadrao : normTipoPrefItem.includes('padrao')) ? 'S' : 'N';

    // 3.5 Submete a consulta em background (Consultar) exatamente como #btnConsultar faz
    let listaDadosExtraida = null;
    let gravouViaSubFrm = false;
    const frm = document.getElementById('frmMinutaLista');
    if (frm && frm.action) {
      try {
        const setHdn = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        setHdn('hdnNumChavePesquisaMinuta', '');
        setHdn('hdnNumChavePesquisaDocumento', '');
        setHdn('hdnSinListarDocumentosGedpro', 'N');
        setHdn('hdnConsultaNormal', 'true');
        setHdn('hdnOrigemExterna', '');
        setHdn('solr_forcar_pesquisa', 'N');
        if (document.getElementById('hdnInfraPaginaAtual')) {
          document.getElementById('hdnInfraPaginaAtual').value = '0';
        }

        const formData = new FormData(frm);
        const searchParams = new URLSearchParams();
        for (const [k, v] of formData.entries()) {
          if (v === 'null' && (k === 'selTipoDocumento[]' || k === 'selStatusMinuta[]' || k === 'selLocalizador[]')) {
            continue;
          }
          if (k === 'isChangePreferencia' || k === 'hdnStrDescricaoPreferencia' || k === 'hdnStrPreferenciaUsuario') {
            continue;
          }
          searchParams.append(k, v);
        }
        if (orgaoLotacao.sigla) {
          searchParams.set('texOrgaoProprietario', orgaoLotacao.sigla);
        }
        if (orgaoLotacao.idOrgao) {
          searchParams.set('hdnIdOrgaoProprietario', orgaoLotacao.idOrgao);
        }
        searchParams.set('hdnPreferencia', '');
        searchParams.set('txtPreferencia', '');
        searchParams.set('hdnNumIdValorSelecionadoCombo', '');
        const respConsulta = await fetch(frm.action, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: searchParams.toString()
        });
        if (respConsulta.ok) {
          const htmlConsulta = await respConsulta.text();
          const docCons = new DOMParser().parseFromString(htmlConsulta, 'text/html');

          // Sincroniza chaves de pesquisa geradas pela consulta para o DOM atual
          ['hdnNumChavePesquisaMinuta', 'hdnNumChavePesquisaDocumento', 'hdnNumFiltros', 'hdnFiltroExibicao'].forEach(id => {
            const elNovo = docCons.getElementById(id);
            const elAtual = document.getElementById(id);
            if (elNovo && elAtual) elAtual.value = elNovo.value;
          });

          // Verifica se o pós-consulta habilitou #btnSalvar com exibirSubFrm('controlador.php?acao=formulario_personalizacao_subfrm_salvar_consulta...')
          const btnSalvarCons = docCons.getElementById('btnSalvar');
          const onclickSalvar = btnSalvarCons ? (btnSalvarCons.getAttribute('onclick') || '') : '';
          const mSubUrl = onclickSalvar.match(/exibirSubFrm\(\s*['"]([^'"]+)['"]/i);
          if (mSubUrl && mSubUrl[1]) {
            const urlSubFrmSalvar = mSubUrl[1].replace(/&amp;/g, '&');
            try {
              const respSub = await fetch(urlSubFrmSalvar, { credentials: 'same-origin' });
              if (respSub.ok) {
                const htmlSub = await respSub.text();

                // Extrai a URL de gravação do SubFrm (acao_ajax=gravar_preferencias_subfrm) e o arrSession
                const mUrlGravarSub = htmlSub.match(/['"](controlador_ajax\.php\?acao_ajax=gravar_preferencias_subfrm[^'"]+)['"]/i);
                const mUrlVinculoSub = htmlSub.match(/['"](controlador_ajax\.php\?acao_ajax=validar_acao_preferencial_vinculo_localizadores[^'"]+)['"]/i);
                const mArrSession = htmlSub.match(/var\s+arrSession\s*=\s*['"]([^'"]*)['"]/i);
                const arrSessionVal = mArrSession ? mArrSession[1] : '';

                if (mUrlGravarSub && mUrlGravarSub[1]) {
                  const urlGravarSub = mUrlGravarSub[1].replace(/&amp;/g, '&');
                  const postarSub = {
                    hdnNumIdFormPersonalizacao: '',
                    hdnAcaoOrigem: 'minuta_area_trabalho',
                    hdnAcaoPreferencia: 'minuta_area_trabalho',
                    chkValorPadrao: chkPadraoVal,
                    chkPainelInicial: chkPainelVal,
                    txtDescricao: typeof toHtmlEntityDecimal === 'function' ? toHtmlEntityDecimal(item.nome) : item.nome,
                    rdPrefTipo: rdPrefTipoVal,
                    arrSession: arrSessionVal,
                    chkMovPref: 'N',
                    selGrupo: (idGrupo && idGrupo !== 'null' && rdPrefTipoVal === 'U') ? idGrupo : 'null'
                  };

                  const paramsSub = new URLSearchParams();
                  Object.entries(postarSub).forEach(([k, v]) => paramsSub.append(k, v));

                  // Executa validação prévia de vínculo de localizadores (igual ao fluxo nativo de salvarPreferencia)
                  if (mUrlVinculoSub && mUrlVinculoSub[1]) {
                    try {
                      await fetch(mUrlVinculoSub[1].replace(/&amp;/g, '&'), {
                        method: 'POST',
                        credentials: 'same-origin',
                        headers: {
                          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                          'X-Requested-With': 'XMLHttpRequest'
                        },
                        body: paramsSub.toString()
                      });
                    } catch (eVinc) {}
                  }

                  // Grava a preferência vinculada à consulta recém-executada na sessão
                  const respGravarSub = await fetch(urlGravarSub, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                      'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: paramsSub.toString()
                  });

                  if (respGravarSub.ok) {
                    const textRespSub = await respGravarSub.text();
                    let objRespSub = null;
                    try { objRespSub = JSON.parse(textRespSub); } catch (eJ) {}

                    if (objRespSub) {
                      if (objRespSub.sucesso === 'true' || objRespSub.sucesso === true) {
                        gravouViaSubFrm = true;
                        if (objRespSub.idPreferencia && window._eprocMapaPreferenciasAreaMinutas) {
                          window._eprocMapaPreferenciasAreaMinutas.set(normalizar(item.nome), String(objRespSub.idPreferencia));
                          window._eprocMapaPreferenciasAreaMinutas.set(item.nome.trim(), String(objRespSub.idPreferencia));
                        }
                      } else {
                        const msgErroSub = objRespSub.msg || 'Erro ao gravar preferência via SubFrm.';
                        const msgNormSub = normalizar(msgErroSub);
                        if (msgNormSub.includes('ja existe') || msgNormSub.includes('mesma descricao')) {
                          throw new Error('DUPLICADA: ' + msgErroSub);
                        }
                        throw new Error(msgErroSub);
                      }
                    } else if (/sucesso["']?\s*:\s*["']?true/i.test(textRespSub)) {
                      gravouViaSubFrm = true;
                    }
                  }
                }
              }
            } catch (eSub) {
              if (eSub.message && eSub.message.startsWith('DUPLICADA:')) {
                throw eSub;
              }
              addLog('⚠️ Aviso ao gravar via SubFrm da consulta: ' + eSub.message, 'warn');
            }
          }
        }
      } catch (eCons) {
        if (eCons.message && eCons.message.startsWith('DUPLICADA:')) {
          throw eCons;
        }
        addLog('⚠️ Aviso na consulta da Área de Minutas: ' + eCons.message, 'warn');
      }
    }

    // 4. Constrói listaDados serializada como fallback caso gravar_preferencias_subfrm não tenha sido acionado
    if (!gravouViaSubFrm && typeof window.validarPreferencias === 'function') {
      const origGravar = window.gravarPreferencias;
      const origAlert = window.alert;
      try {
        window.gravarPreferencias = function (ld) {
          listaDadosExtraida = ld;
        };
        window.alert = function () {};
        window.validarPreferencias();
      } catch (eVal) {} finally {
        window.gravarPreferencias = origGravar;
        window.alert = origAlert;
      }
    }

    const arrDados = [];
    if (orgaoLotacao.sigla) arrDados.push('texOrgaoProprietario|' + orgaoLotacao.sigla);
    if (orgaoLotacao.idOrgao) arrDados.push('hdnIdOrgaoProprietario|' + orgaoLotacao.idOrgao);
    arrDados.push('selTipoDocumento|' + tiposSelecionados.filter(v => v && v !== 'null').join(';'));
    arrDados.push('selStatusMinuta|' + statusSelecionados.filter(v => v && v !== 'null').join(';'));
    arrDados.push('selLocalizador|' + locsSelecionados.filter(v => v && v !== 'null').join(';'));
    arrDados.push('txtUsuarioCriador|' + valUsuarioReal);
    arrDados.push('hdnIdUsuarioCriador|' + valUsuarioReal);

    const listaDados = listaDadosExtraida || arrDados.join(',');

    // 5. Garante que os campos de suporte a preferências existam no DOM
    let divPref = document.getElementById('divPrefOpcoes');
    if (!divPref) {
      divPref = document.createElement('div');
      divPref.id = 'divPrefOpcoes';
      divPref.style.display = 'none';
      divPref.innerHTML = `
        <input type="text" id="txtDescricaoCadastro" name="txtDescricaoCadastro">
        <input type="radio" name="rdPrefTipo" id="rdUnidade" value="U" checked>
        <select id="selFormularioPersonalizacaoGrupo"></select>
        <input type="checkbox" id="chkValorPadrao" value="S">
        <input type="checkbox" id="chkPainelInicial" value="S">
        <input type="hidden" id="hdnAcaoPreferencia" value="salvar">
        <button type="button" id="btnOK">OK</button>
      `;
      const formPrincipal = document.getElementById('frmMinutaLista') || document.body;
      formPrincipal.appendChild(divPref);
    }

    const txtDescricaoCadastro = document.getElementById('txtDescricaoCadastro');
    if (txtDescricaoCadastro) txtDescricaoCadastro.value = item.nome;

    const chkPainelEl = document.getElementById('chkPainelInicial');
    if (chkPainelEl) chkPainelEl.checked = (chkPainelVal === 'S');

    const chkPadraoEl = document.getElementById('chkValorPadrao');
    if (chkPadraoEl) chkPadraoEl.checked = (chkPadraoVal === 'S');

    const rdU = document.getElementById('rdUnidade');
    if (rdU) rdU.checked = (rdPrefTipoVal === 'U');

    const selFormGrupo = document.getElementById('selFormularioPersonalizacaoGrupo');
    if (selFormGrupo) {
      if (idGrupo && idGrupo !== 'null') {
        let optG = Array.from(selFormGrupo.options).find(o => o.value === idGrupo);
        if (!optG) {
          optG = document.createElement('option');
          optG.value = idGrupo;
          optG.text = item.grupo;
          selFormGrupo.appendChild(optG);
        }
        optG.selected = true;
        selFormGrupo.value = idGrupo;
      } else {
        selFormGrupo.value = 'null';
      }
    }

    // 5.5 Salvamento pelo fluxo nativo (SubFrm pós-consulta)
    let gravouSucesso = gravouViaSubFrm;
    let motivoFalhaNativa = '';
    if (false && frm) { // desativado: o iframe da consulta não carrega nesta tela (timeout)
      const rNat = await salvarPreferenciaAreaMinutasViaPaginaNativa(frm, item, idGrupo);
      if (rNat.duplicada) throw new Error('DUPLICADA: ' + rNat.msg);
      if (rNat.ok) { gravouSucesso = true; addLog('💾 eproc: ' + rNat.msg); }
      else { motivoFalhaNativa = rNat.msg; addLog('⚠️ Salvamento nativo não confirmou: ' + rNat.msg + ' — tentando gravação direta...', 'warn'); }
    }

    // 6. Envio para gravação: extrai a URL exata de gravar_preferencias_cadastrar_formulario (com seu hash próprio da ação)
    let urlGravarExata = '';
    const matchUrlGravar = document.documentElement.innerHTML.match(/['"](controlador_ajax\.php\?acao_ajax=gravar_preferencias_cadastrar_formulario[^'"]+)['"]/i);
    if (matchUrlGravar && matchUrlGravar[1]) {
      urlGravarExata = matchUrlGravar[1].replace(/&amp;/g, '&');
    }

    if (!gravouSucesso && urlGravarExata) {
      const postar = {
        listaDados: listaDados,
        chkValorPadrao: chkPadraoVal,
        chkMovPreferencial: 'N',
        txtDescricaoCadastro: typeof toHtmlEntityDecimal === 'function' ? toHtmlEntityDecimal(item.nome) : item.nome,
        nomeAcao: 'minuta_area_trabalho',
        rdPrefTipo: rdPrefTipoVal,
        sinExibirPainel: chkPainelVal,
        selGrupo: idGrupo
      };

      const params = new URLSearchParams();
      Object.entries(postar).forEach(([k, v]) => params.append(k, v));

      const resp = await fetch(urlGravarExata, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: params.toString()
      });

      if (resp.ok) {
        const textResp = await resp.text();
        let objResp = null;
        try { objResp = JSON.parse(textResp); } catch (eJ) {}

        if (objResp) {
          if (objResp.sucesso === 'true' || objResp.sucesso === true) {
            gravouSucesso = true;
          } else {
            const msg = objResp.msg || 'Erro desconhecido ao salvar preferência.';
            const msgNorm = normalizar(msg);
            if (msgNorm.includes('ja existe') || msgNorm.includes('mesma descricao')) {
              throw new Error('DUPLICADA: ' + msg);
            }
            throw new Error(msg);
          }
        } else if (/sucesso["']?\s*:\s*["']?true/i.test(textResp)) {
          gravouSucesso = true;
        } else {
          addLog('⚠️ Resposta inesperada do eproc ao gravar: ' + textResp.slice(0, 200), 'warn');
        }
      }
    }

    // Fallback: chama window.gravarPreferencias(listaDados) se o POST direto ainda não confirmou
    if (!gravouSucesso && typeof window.gravarPreferencias === 'function') {
      ultimoAvisoEproc = '';
      window.gravarPreferencias(listaDados);

      let aguardou = 0;
      while (aguardou < 5000) {
        if (window._eprocPararLote) break;
        await sleep(250);
        aguardou += 250;
        if (ultimoAvisoEproc) {
          const avNorm = normalizar(ultimoAvisoEproc);
          if (avNorm.includes('cadastrada') || avNorm.includes('atualizada') || avNorm.includes('sucesso')) {
            gravouSucesso = true;
            break;
          }
          if (avNorm.includes('duplicada') || avNorm.includes('ja existe') || avNorm.includes('mesma descricao')) {
            throw new Error('DUPLICADA: ' + ultimoAvisoEproc);
          }
          if (avNorm.includes('erro') || avNorm.includes('falha')) {
            throw new Error(ultimoAvisoEproc);
          }
        }
      }
    }

    if (!gravouSucesso) {
      throw new Error('Não foi possível confirmar a gravação da preferência na Área de Minutas.' + (motivoFalhaNativa ? ' Detalhe: ' + motivoFalhaNativa : ''));
    }

    addLog(`✅ Preferência da Área de Minutas gravada com sucesso: "${item.nome}"`, 'success');
    return {
      linha: item.linha,
      nome: item.nome,
      tipoPref: rdPrefTipoVal === 'I' ? 'Individual' : 'Unidade',
      exibirPainel: chkPainelVal === 'S',
      grupo: item.grupo || '(Nenhum)',
      orgaoProprietario: orgaoLotacao.sigla || (texOrgaoEl ? texOrgaoEl.value.trim() : '-'),
      tipoDocumento: textosTiposSelecionados.length > 0 ? textosTiposSelecionados.join(', ') : (item.tipoDocumento || '-'),
      statusMinuta: descStatusLog,
      localizador: descLocLog,
      locPrincipalFallback: locFallbackUsado,
      usuarioCriador: valUsuarioReal || (ehPlaceholderUsuario ? '(Em branco - preencher matrícula depois)' : '-'),
      sucesso: true,
      erro: null
    };
  }

  /* ========================================================================== */
  /* [MÓDULO 5: INTIMAÇÕES ELETRÔNICAS - v3.5]                                  */
  /* Criação automatizada de preferências na tela de Intimação Eletrônica      */
  /* (processo_intimacao / processo_intimacao_bloco)                           */
  /* ========================================================================== */

  async function obterPreferenciaIntimacaoExistentes() {
    const existentes = new Set();

    const registrar = (nome) => {
      if (!nome) return;
      const n = decodificarEntidadesHtml(nome).trim();
      if (!n || n.length < 2) return;
      existentes.add(n);
      const norm = normalizar(n);
      if (norm) existentes.add(norm);
    };

    // 1. Tenta carregar do autocomplete nativo se disponível
    try {
      if (window.objAjaxAutoCompPreferencia && Array.isArray(window.objAjaxAutoCompPreferencia.arrItens)) {
        window.objAjaxAutoCompPreferencia.arrItens.forEach(it => {
          registrar(it.descricao || it.label || it.value);
        });
      }
    } catch (e) {}

    // 2. Consulta o endpoint ajax do autocomplete de preferências para processo_intimacao_bloco
    try {
      let urlAuto = '';
      if (window.objAjaxAutoCompPreferencia && (window.objAjaxAutoCompPreferencia.ajaxTarget || window.objAjaxAutoCompPreferencia.urlServico)) {
        urlAuto = window.objAjaxAutoCompPreferencia.ajaxTarget || window.objAjaxAutoCompPreferencia.urlServico;
      }
      if (!urlAuto) {
        const m = document.documentElement.innerHTML.match(/['"](controlador_ajax\.php\?acao_ajax=preferencia_auto_completar[^'"]*processo_intimacao_bloco[^'"]*)['"]/i);
        if (m && m[1]) urlAuto = m[1].replace(/&amp;/g, '&');
      }
      if (!urlAuto) {
        const h = obterHashAtual();
        if (h) urlAuto = `controlador_ajax.php?acao_ajax=preferencia_auto_completar&nomeAcao=processo_intimacao_bloco&hash=${h}`;
      }
      if (urlAuto) {
        const res = await fetch(urlAuto, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: 'palavra_pesquisa='
        });
        if (res.ok) {
          const txt = await res.text();
          const matches = txt.match(/<item[^>]*descricao=["']([^"']+)["']/gi) || [];
          matches.forEach(mTag => {
            const d = mTag.match(/descricao=["']([^"']+)["']/i);
            if (d && d[1]) registrar(d[1]);
          });
        }
      }
    } catch (e) {}

    // 3. Fallback: Consulta gerenciador geral
    try {
      const listaUnid = await obterTodasPreferenciasUnidade();
      if (Array.isArray(listaUnid)) {
        listaUnid.forEach(item => { if (item && item.nome) registrar(item.nome); });
      }
    } catch (e) {}

    return existentes;
  }

  function resetarFormularioIntimacao() {
    try {
      const txtDesc = document.getElementById('txtDescricaoCadastro');
      if (txtDesc) txtDesc.value = '';
      const hdnPref = document.getElementById('hdnPreferencia');
      if (hdnPref) hdnPref.value = '';
      const txtPref = document.getElementById('txtPreferencia');
      if (txtPref) txtPref.value = '';
      const rdUnidade = document.getElementById('rdUnidade');
      if (rdUnidade) rdUnidade.checked = true;
      const rdIndividuais = document.getElementById('rdIndividuais');
      if (rdIndividuais) rdIndividuais.checked = true;
      const chkPadrao = document.getElementById('chkValorPadrao');
      if (chkPadrao) chkPadrao.checked = false;
      const chkMovPref = document.getElementById('chkMovPreferencial');
      if (chkMovPref) chkMovPref.checked = true;
      const chkUrgente = document.getElementById('chkIntimacaoUrgente');
      if (chkUrgente) chkUrgente.checked = false;

      if (typeof window.limparCamposPreferenciaPorTipoParte === 'function') {
        try { window.limparCamposPreferenciaPorTipoParte(); } catch (e) {}
      }
      if (typeof window.limparCamposPreferenciaPorPolo === 'function') {
        try { window.limparCamposPreferenciaPorPolo(); } catch (e) {}
      }
      if (typeof window.limparCamposPartes === 'function') {
        try { window.limparCamposPartes(); } catch (e) {}
      }

      const txtPrazoIgual = document.getElementById('txtPrazoIgual');
      if (txtPrazoIgual) txtPrazoIgual.value = '';
      const txtDataIgual = document.getElementById('txtDataIgual');
      if (txtDataIgual) txtDataIgual.value = '';

      const selNovoLoc = document.getElementById('selNovoLocalizador');
      if (selNovoLoc) selNovoLoc.value = 'null';
      const selDesativar = document.getElementById('selLocalizadorDesativar');
      if (selDesativar) {
        Array.from(selDesativar.options).forEach(o => { o.selected = false; });
      }
      const chkEnc = document.getElementById('chkEncadeamentoIntimar');
      if (chkEnc) chkEnc.checked = false;
    } catch (e) {}
  }

  // [v3.5.5] Garante que #fldOpcoesAvancadas e #fldAlterarLocalizadores existam no DOM e tenham opções
  async function garantirEstruturaDomOpcoesAvancadasELocalizadores() {
    const form = document.getElementById('frmProcessoCitacao') || document.querySelector('form');
    if (!form) return;

    const fldAcoes = document.getElementById('fldAcoes');
    const divAreaDados = document.getElementById('divInfraAreaDados');

    // 1. Garante #fldOpcoesAvancadas com #porTipoDeParte, #porPolo e campos de prazo
    if (!document.getElementById('fldOpcoesAvancadas') || !document.getElementById('porPolo') || !document.getElementById('txtPrazoMPF')) {
      const wrapperOp = document.createElement('div');
      wrapperOp.id = 'divResultado';
      wrapperOp.style.display = 'block';
      wrapperOp.innerHTML = `
        <fieldset id="fldOpcoesAvancadas" class="infraFieldset" style="margin-top: 15px; width: 100%; display: block;">
          <legend class="infraLegendOpcional">&nbsp;<img src="infra_css/imagens/menos.gif" title="Ocultar/Exibir Opções Avançadas" id="imgStatusConteudoAcoesNoProcesso" onclick="infraAbrirFecharElementoHTML('conteudoAcoesNoProcesso','imgStatusConteudoAcoesNoProcesso')">&nbsp;Opções Avançadas&nbsp;</legend>
          <div id="conteudoAcoesNoProcesso" style="display: block;">
            <div style="margin: 8px 0 12px 0;">
              <label style="margin-right: 40px; cursor: pointer;">
                <input type="radio" id="porTipoDeParte" name="opcoes_avancadas" value="porTipoDeParte" class="infraRadio" onclick="if(typeof checkTipoDeParte==='function')checkTipoDeParte(true);"> Por Tipo de Parte
              </label>
              <label id="lblPorPolo" style="cursor: pointer;">
                <input type="radio" id="porPolo" name="opcoes_avancadas" value="porPolo" class="infraRadio" onclick="if(typeof checkPorPolo==='function')checkPorPolo(true);"> Por Pólo
              </label>
            </div>
            <hr style="margin: 6px 0 10px 0;">
            <!-- Container Por Tipo de Parte -->
            <div class="tipoParte" style="display: none;">
              <div class="divLinha" style="margin-bottom: 6px;">
                <input type="checkbox" id="chkSelTodosTipoParte" name="chkSelTodosTipoParte" class="infraCheckbox" onchange="if(typeof onChangeChkSelTodosTipoParte==='function')onChangeChkSelTodosTipoParte();">
                <label for="chkSelTodosTipoParte"><b><u>Todos</u></b></label>
                <span style="margin-left: 120px;">Prazo: <input type="text" id="txtPrazoTodos" name="txtPrazoTodos" class="infraText" style="width: 55px;" onkeyup="if(typeof onKeyUpTxtPrazoTodos==='function')onKeyUpTxtPrazoTodos();" onchange="if(typeof onChangeTxtPrazoTodos==='function')onChangeTxtPrazoTodos();"> dias</span>
                <input type="hidden" id="txtDataTodos" name="txtDataTodos" value="">
                <input type="checkbox" id="chkSelIntimacaoUrgenteTodos" name="chkSelIntimacaoUrgenteTodos" style="margin-left: 15px;"> Intimação Urgente (Todos)
              </div>
              <div id="linhaTipoParteEntPrazoEspecial" class="divLinha" style="margin-bottom: 6px; padding-left: 20px;">
                <input type="checkbox" id="chkSelEntPrazoEspecial" name="chkSelEntPrazoEspecial" class="infraCheckbox" onchange="if(typeof onChangeChkSelEntPrazoEspecial==='function')onChangeChkSelEntPrazoEspecial();">
                <label for="chkSelEntPrazoEspecial" style="color: #d00; font-weight: bold;"><u>Entidades com prazo especial</u></label>
                <span style="margin-left: 45px;">Prazo: <input type="text" id="txtPrazoEntPrazoEspecial" name="txtPrazoEntPrazoEspecial" class="infraText" style="width: 55px;" onkeyup="if(typeof onKeyUpTxtPrazoEntPrazoEspecial==='function')onKeyUpTxtPrazoEntPrazoEspecial();" onchange="if(typeof onChangeTxtPrazoEntPrazoEspecial==='function')onChangeTxtPrazoEntPrazoEspecial();"> dias</span>
                <input type="hidden" id="txtDataEntPrazoEspecial" name="txtDataEntPrazoEspecial" value="">
                <input type="checkbox" id="chkSelParteIntimacaoUrgenteEntPrazoEspecial" name="chkSelParteIntimacaoUrgenteEntPrazoEspecial" style="margin-left: 15px;"> Intimação Urgente
              </div>
              <div id="linhaTipoParteEntPrazoSimples" class="divLinha" style="margin-bottom: 6px; padding-left: 20px;">
                <input type="checkbox" id="chkSelEntPrazoSimples" name="chkSelEntPrazoSimples" class="infraCheckbox" onchange="if(typeof onChangeChkSelEntPrazoSimples==='function')onChangeChkSelEntPrazoSimples();">
                <label for="chkSelEntPrazoSimples" style="color: #e68a00; font-weight: bold;"><u>Entidades com prazo simples</u></label>
                <span style="margin-left: 48px;">Prazo: <input type="text" id="txtPrazoEntPrazoSimples" name="txtPrazoEntPrazoSimples" class="infraText" style="width: 55px;" onkeyup="if(typeof onKeyUpTxtPrazoEntPrazoSimples==='function')onKeyUpTxtPrazoEntPrazoSimples();" onchange="if(typeof onChangeTxtPrazoEntPrazoSimples==='function')onChangeTxtPrazoEntPrazoSimples();"> dias</span>
                <input type="hidden" id="txtDataEntPrazoSimples" name="txtDataEntPrazoSimples" value="">
                <input type="checkbox" id="chkSelParteIntimacaoUrgenteEntPrazoSimples" name="chkSelParteIntimacaoUrgenteEntPrazoSimples" style="margin-left: 15px;"> Intimação Urgente
              </div>
              <div class="divLinha" style="margin-bottom: 6px; padding-left: 20px;">
                <input type="checkbox" id="chkSelNaoEntPrazoSimples" name="chkSelNaoEntPrazoSimples" class="infraCheckbox" onchange="if(typeof onChangeChkSelNaoEntPrazoSimples==='function')onChangeChkSelNaoEntPrazoSimples();">
                <label for="chkSelNaoEntPrazoSimples" style="color: #0000ee; font-weight: bold;"><u>Partes com prazo simples</u></label>
                <span style="margin-left: 65px;">Prazo: <input type="text" id="txtPrazoNaoEntPrazoSimples" name="txtPrazoNaoEntPrazoSimples" class="infraText" style="width: 55px;" onkeyup="if(typeof onKeyUpTxtPrazoNaoEntPrazoSimples==='function')onKeyUpTxtPrazoNaoEntPrazoSimples();" onchange="if(typeof onChangeTxtPrazoNaoEntPrazoSimples==='function')onChangeTxtPrazoNaoEntPrazoSimples();"> dias</span>
                <input type="hidden" id="txtDataNaoEntPrazoSimples" name="txtDataNaoEntPrazoSimples" value="">
                <input type="checkbox" id="chkSelParteIntimacaoUrgenteNaoEntPrazoSimples" name="chkSelParteIntimacaoUrgenteNaoEntPrazoSimples" style="margin-left: 15px;"> Intimação Urgente
              </div>
              <div class="divLinha" style="margin-bottom: 6px; padding-left: 20px;">
                <input type="checkbox" id="chkSelDPU" name="chkSelDPU" class="infraCheckbox" onchange="if(typeof onChangeChkSelDPU==='function')onChangeChkSelDPU();">
                <label for="chkSelDPU" style="color: #008000; font-weight: bold;"><u>DPU e Escritórios de Prática Jurídica</u></label>
                <span style="margin-left: 12px;">Prazo: <input type="text" id="txtPrazoDPU" name="txtPrazoDPU" class="infraText" style="width: 55px;" onkeyup="if(typeof onKeyUpTxtPrazoDPU==='function')onKeyUpTxtPrazoDPU();" onchange="if(typeof onChangeTxtPrazoDPU==='function')onChangeTxtPrazoDPU();"> dias</span>
                <input type="hidden" id="txtDataDPU" name="txtDataDPU" value="">
                <input type="checkbox" id="chkSelParteIntimacaoUrgenteDPU" name="chkSelParteIntimacaoUrgenteDPU" style="margin-left: 15px;"> Intimação Urgente
              </div>
              <div class="divLinha" style="margin-bottom: 6px;">
                <input type="checkbox" id="chkSelPeritosECia" name="chkSelPeritosECia" class="infraCheckbox" onchange="if(typeof onChangeChkSelPeritosECia==='function')onChangeChkSelPeritosECia();">
                <label for="chkSelPeritosECia" style="color: #808080; font-weight: bold;"><u>Peritos, Autoridades Coatoras, Unidades Externas e APS já incluídas</u></label>
                <span style="margin-left: 12px;">Prazo: <input type="text" id="txtPrazoPeritosECia" name="txtPrazoPeritosECia" class="infraText" style="width: 55px;"> dias</span>
                <input type="hidden" id="txtDataPeritosECia" name="txtDataPeritosECia" value="">
                <input type="checkbox" id="chkSelParteIntimacaoUrgentePeritosECia" name="chkSelParteIntimacaoUrgentePeritosECia" style="margin-left: 15px;"> Intimação Urgente
              </div>
              <div id="linhaTipoParteEntQQPrazo" class="divLinha" style="display: none;">
                <input type="checkbox" id="chkSelEntQQPrazo" name="chkSelEntQQPrazo">
                <input type="text" id="txtPrazoEntQQPrazo" name="txtPrazoEntQQPrazo" value="">
                <input type="hidden" id="txtDataEntQQPrazo" name="txtDataEntQQPrazo" value="">
                <input type="checkbox" id="chkSelParteIntimacaoUrgenteEntQQPrazo" name="chkSelParteIntimacaoUrgenteEntQQPrazo">
              </div>
            </div>
            <!-- Container Por Pólo -->
            <div class="porPolo" style="display: block;">
              <div class="divLinha" style="margin-bottom: 6px;">
                <input type="checkbox" id="chkSelTodosPolo" name="chkSelTodosPolo" class="infraCheckbox" onchange="if(typeof onChangeChkSelTodosPolo==='function')onChangeChkSelTodosPolo();">
                <label for="chkSelTodosPolo"><b><u>Todos</u></b></label>
                <span style="margin-left: 140px;">Prazo: <input type="text" id="txtPrazoTodosPolo" name="txtPrazoTodosPolo" class="infraText" style="width: 55px;" onkeyup="if(typeof onKeyUpTxtPrazoTodosPolo==='function')onKeyUpTxtPrazoTodosPolo();" onchange="if(typeof onChangeTxtPrazoTodosPolo==='function')onChangeTxtPrazoTodosPolo();"> dias</span>
                <input type="hidden" id="txtDataTodosPolo" name="txtDataTodosPolo" value="">
                <input type="checkbox" id="chkSelPrazoIntimacaoUrgenteTodos" name="chkSelPrazoIntimacaoUrgenteTodos" style="margin-left: 15px;"> Intimação Urgente (Todos)
              </div>
              <div class="divLinha" style="margin-bottom: 6px; padding-left: 20px;">
                <input type="checkbox" id="chkSelPrazoAutores" name="chkSelPrazoAutores" class="infraCheckbox" onchange="if(typeof onChangeChkSelPrazoAutores==='function')onChangeChkSelPrazoAutores();">
                <label for="chkSelPrazoAutores" style="color: #008000; font-weight: bold;"><u>Polo Ativo</u></label>
                <span style="margin-left: 100px;">Prazo: <input type="text" id="txtPrazoAutores" name="txtPrazoAutores" class="infraText" style="width: 55px;" onkeyup="if(typeof onKeyUpTxtPrazoAutores==='function')onKeyUpTxtPrazoAutores();" onchange="if(typeof onChangeTxtPrazoAutores==='function')onChangeTxtPrazoAutores();"> dias</span>
                <input type="hidden" id="txtDataAutores" name="txtDataAutores" value="">
                <input type="checkbox" id="chkSelPrazoIntimacaoUrgenteAutores" name="chkSelPrazoIntimacaoUrgenteAutores" style="margin-left: 15px;"> Intimação Urgente
              </div>
              <div class="divLinha" style="margin-bottom: 6px; padding-left: 20px;">
                <input type="checkbox" id="chkSelPrazoReus" name="chkSelPrazoReus" class="infraCheckbox" onchange="if(typeof onChangeChkSelPrazoReus==='function')onChangeChkSelPrazoReus();">
                <label for="chkSelPrazoReus" style="color: #d00; font-weight: bold;"><u>Polo Passivo</u></label>
                <span style="margin-left: 86px;">Prazo: <input type="text" id="txtPrazoReus" name="txtPrazoReus" class="infraText" style="width: 55px;" onkeyup="if(typeof onKeyUpTxtPrazoReus==='function')onKeyUpTxtPrazoReus();" onchange="if(typeof onChangeTxtPrazoReus==='function')onChangeTxtPrazoReus();"> dias</span>
                <input type="hidden" id="txtDataReus" name="txtDataReus" value="">
                <input type="checkbox" id="chkSelPrazoIntimacaoUrgenteReus" name="chkSelPrazoIntimacaoUrgenteReus" style="margin-left: 15px;"> Intimação Urgente
              </div>
              <div class="divLinha" style="margin-bottom: 6px; padding-left: 20px;">
                <input type="checkbox" id="chkSelPrazoInteressados" name="chkSelPrazoInteressados" class="infraCheckbox" onchange="if(typeof onChangeChkSelPrazoInteressados==='function')onChangeChkSelPrazoInteressados();">
                <label for="chkSelPrazoInteressados" style="color: #cc6600; font-weight: bold;"><u>Terceiro/Interessado</u></label>
                <span style="margin-left: 38px;">Prazo: <input type="text" id="txtPrazoInteressados" name="txtPrazoInteressados" class="infraText" style="width: 55px;" onkeyup="if(typeof onKeyUpTxtPrazoInteressados==='function')onKeyUpTxtPrazoInteressados();" onchange="if(typeof onChangeTxtPrazoInteressados==='function')onChangeTxtPrazoInteressados();"> dias</span>
                <input type="hidden" id="txtDataInteressados" name="txtDataInteressados" value="">
                <input type="checkbox" id="chkSelPrazoIntimacaoUrgenteInteressados" name="chkSelPrazoIntimacaoUrgenteInteressados" style="margin-left: 15px;"> Intimação Urgente
              </div>
              <div class="divLinha" style="margin-bottom: 6px; padding-left: 20px;">
                <input type="checkbox" id="chkSelMPF" name="chkSelMPF" class="infraCheckbox" onchange="if(typeof onChangeChkSelMPF==='function')onChangeChkSelMPF();">
                <label for="chkSelMPF" style="color: #0000ee; font-weight: bold;"><u>MP (Custos iuris)</u></label>
                <span style="margin-left: 56px;">Prazo: <input type="text" id="txtPrazoMPF" name="txtPrazoMPF" class="infraText" style="width: 55px;" onkeyup="if(typeof onKeyUpTxtPrazoMPF==='function')onKeyUpTxtPrazoMPF();" onchange="if(typeof onChangeTxtPrazoMPF==='function')onChangeTxtPrazoMPF();"> dias</span>
                <input type="hidden" id="txtDataMPF" name="txtDataMPF" value="">
                <input type="checkbox" id="chkSelPrazoIntimacaoUrgenteMPF" name="chkSelPrazoIntimacaoUrgenteMPF" style="margin-left: 15px;"> Intimação Urgente
              </div>
              <div class="divLinha" style="margin-bottom: 6px; padding-left: 20px;">
                <input type="checkbox" id="chkSelOutros" name="chkSelOutros" class="infraCheckbox" onchange="if(typeof onChangeChkSelOutros==='function')onChangeChkSelOutros();">
                <label for="chkSelOutros" style="color: #666; font-weight: bold;"><u>Outros</u></label>
                <span style="margin-left: 118px;">Prazo: <input type="text" id="txtPrazoOutros" name="txtPrazoOutros" class="infraText" style="width: 55px;" onkeyup="if(typeof onKeyUpTxtPrazoOutros==='function')onKeyUpTxtPrazoOutros();" onchange="if(typeof onChangeTxtPrazoOutros==='function')onChangeTxtPrazoOutros();"> dias</span>
                <input type="hidden" id="txtDataOutros" name="txtDataOutros" value="">
                <input type="checkbox" id="chkSelPrazoIntimacaoUrgenteOutros" name="chkSelPrazoIntimacaoUrgenteOutros" style="margin-left: 15px;"> Intimação Urgente
              </div>
              <div class="divLinha" style="margin-bottom: 6px;">
                <input type="checkbox" id="chkSelPeritosECiaPolo" name="chkSelPeritosECiaPolo" class="infraCheckbox" onchange="if(typeof onChangeChkSelPeritosECiaPolo==='function')onChangeChkSelPeritosECiaPolo();">
                <label for="chkSelPeritosECiaPolo" style="color: #808080; font-weight: bold;"><u>Peritos, Autoridades Coatoras, Unidades Externas e APS já incluídas</u></label>
                <span style="margin-left: 12px;">Prazo: <input type="text" id="txtPrazoPeritosECiaPolo" name="txtPrazoPeritosECiaPolo" class="infraText" style="width: 55px;"> dias</span>
                <input type="hidden" id="txtDataPeritosECiaPolo" name="txtDataPeritosECiaPolo" value="">
                <input type="checkbox" id="chkSelPrazoIntimacaoUrgentePeritos" name="chkSelPrazoIntimacaoUrgentePeritos" style="margin-left: 15px;"> Intimação Urgente
              </div>
            </div>
          </div>
        </fieldset>
      `;
      if (fldAcoes && fldAcoes.parentNode === form) {
        form.insertBefore(wrapperOp, fldAcoes);
      } else if (divAreaDados && divAreaDados.parentNode === form) {
        divAreaDados.insertAdjacentElement('afterend', wrapperOp);
      } else {
        form.appendChild(wrapperOp);
      }
    }

    // 2. Garante #fldAlterarLocalizadores com #selNovoLocalizador e #selLocalizadorDesativar
    if (!document.getElementById('selNovoLocalizador')) {
      const fldLoc = document.createElement('fieldset');
      fldLoc.id = 'fldAlterarLocalizadores';
      fldLoc.className = 'infraFieldset fldAlterarLocalizadoresIntimacao';
      fldLoc.style.cssText = 'margin-top: 15px; width: 100%; display: block;';
      fldLoc.innerHTML = `
        <legend class="infraLegendOpcional">&nbsp;<img src="infra_css/imagens/menos.gif" title="Ocultar/Exibir Localizadores" id="imgStatusConteudoAlterarLocalizadores" onclick="infraAbrirFecharElementoHTML('conteudoAlterarLocalizadores','imgStatusConteudoAlterarLocalizadores')">&nbsp;Gerenciar Localizadores&nbsp;</legend>
        <div id="conteudoAlterarLocalizadores" style="display: block; padding: 8px;">
          <input type="hidden" id="hdnExigeLocalizador" name="hdnExigeLocalizador" value="N">
          <div style="margin-bottom: 10px;">
            <label for="selLocalizadorDesativar" class="infraLabelOpcional" style="display: block;">Localizadores atuais do processo (selecione para desativar):</label>
            <select id="selLocalizadorDesativar" name="selLocalizadorDesativar[]" multiple="multiple" class="infraSelect" style="width: 60%; min-height: 60px;"></select>
          </div>
          <div>
            <label for="selNovoLocalizador" class="infraLabelOpcional" style="display: block;">Novo localizador:</label>
            <select id="selNovoLocalizador" name="selNovoLocalizador" class="infraSelect" style="width: 60%;">
              <option value="null">MANTER LOCALIZADOR ATUAL</option>
            </select>
          </div>
        </div>
      `;
      if (fldAcoes && fldAcoes.parentNode === form) {
        form.insertBefore(fldLoc, fldAcoes);
      } else {
        form.appendChild(fldLoc);
      }
    }

    // 3. Popula #selNovoLocalizador e #selLocalizadorDesativar com o catálogo unificado da Unidade
    const selNovoLoc = document.getElementById('selNovoLocalizador');
    const selDesativar = document.getElementById('selLocalizadorDesativar');
    try {
      const locsUnidade = await obterOuCarregarCatalogoLocalizadoresUnidade();
      if (Array.isArray(locsUnidade) && locsUnidade.length > 0) {
        for (const loc of locsUnidade) {
          const id = String(loc.value || loc.IdLocalizadorOrgao || loc.id || '').trim();
          const label = String(loc.text || loc.label || '').trim() || id;
          if (!id) continue;
          if (selNovoLoc && !Array.from(selNovoLoc.options).some(o => String(o.value) === id)) {
            const opt = document.createElement('option');
            opt.value = id;
            opt.text = label;
            selNovoLoc.appendChild(opt);
          }
          if (selDesativar && !Array.from(selDesativar.options).some(o => String(o.value) === id)) {
            const optD = document.createElement('option');
            optD.value = id;
            optD.text = label;
            selDesativar.appendChild(optD);
          }
        }
        if (selNovoLoc) addLog(`✓ ${selNovoLoc.options.length - 1} localizador(es) da Unidade carregado(s) para Intimações.`, 'info');
      }
    } catch (eLoc) {
      console.warn('Erro ao popular localizadores de Intimações via catálogo:', eLoc);
    }
  }

  // [v3.5.5] Carrega dinamicamente as seções do Evento de Citação/Intimação (#fldOpcoesAvancadas e #fldAlterarLocalizadores)
  // sem permitir reload da página (substituindo o form.submit() bloqueado durante o lote).
  async function carregarSecoesEventoIntimacaoSemReload(idEvento) {
    if (!idEvento || idEvento === 'null') return false;

    // Desativa o handler nativo de submit automático na mudança da combo #selEventoJudicial
    if (window.jQuery) {
      try { window.jQuery('#selEventoJudicial').off('change'); } catch (e) {}
    }

    const jaCarregadoParaMesmoEvento =
      window._eprocUltimoEventoIntimacaoCarregado === String(idEvento) &&
      document.getElementById('fldOpcoesAvancadas') &&
      document.getElementById('porPolo') &&
      document.getElementById('txtPrazoMPF') &&
      document.getElementById('selNovoLocalizador') &&
      document.getElementById('selNovoLocalizador').options.length >= 2;

    if (!jaCarregadoParaMesmoEvento) {
      const form = document.getElementById('frmProcessoCitacao');
      if (form) {
        try {
          addLog(`🔄 Carregando Opções Avançadas e Localizadores para o evento [${idEvento}]...`, 'info');
          const actionAttr = form.getAttribute('action') || window.location.href;
          const actionUrl = new URL(actionAttr.replace(/&amp;/g, '&'), window.location.href).href;

          const formData = new FormData(form);
          formData.set('selEventoJudicial', String(idEvento));
          const hdnPrefVal = (document.getElementById('hdnPreferencia') && document.getElementById('hdnPreferencia').value) || '';
          formData.set('hdnNumIdValorSelecionadoCombo', hdnPrefVal);
          formData.set('isChangePreferencia', '1');
          // Garante que o POST ao controlador apenas renderize os campos do evento, sem tentar gravar preferência incompleta
          formData.set('txtDescricaoCadastro', '');
          formData.set('hdnAcaoPreferencia', '');

          let resp = await fetch(actionUrl, {
            method: 'POST',
            credentials: 'same-origin',
            body: formData
          });

          if (resp.ok) {
            const buf = await resp.arrayBuffer();
            const html = new TextDecoder('iso-8859-1').decode(buf);
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const docForm = doc.getElementById('frmProcessoCitacao');
            const docOpcoes = doc.getElementById('fldOpcoesAvancadas') || doc.getElementById('porPolo');
            const docLoc = doc.getElementById('fldAlterarLocalizadores') || doc.getElementById('selNovoLocalizador');

            if (docForm && (docOpcoes || docLoc)) {
              const curArea = document.getElementById('divInfraAreaDados');
              const curAcoes = document.getElementById('fldAcoes');
              const docArea = docForm.querySelector('#divInfraAreaDados');
              const docAcoes = docForm.querySelector('#fldAcoes');

              if (curArea && curAcoes && docArea && docAcoes && curArea.parentNode === form && curAcoes.parentNode === form) {
                const nodesToRemove = [];
                let ptr = curArea;
                while (ptr && ptr !== curAcoes) {
                  nodesToRemove.push(ptr);
                  ptr = ptr.nextSibling;
                }

                const nodesToInsert = [];
                let dPtr = docArea;
                while (dPtr && dPtr !== docAcoes) {
                  nodesToInsert.push(dPtr);
                  dPtr = dPtr.nextSibling;
                }

                const scriptsParaExecutar = [];
                for (const node of nodesToInsert) {
                  const imported = document.importNode(node, true);
                  if (imported.tagName === 'SCRIPT') {
                    scriptsParaExecutar.push(imported.textContent || '');
                  } else if (imported.querySelectorAll) {
                    imported.querySelectorAll('script').forEach(s => {
                      scriptsParaExecutar.push(s.textContent || '');
                      s.remove();
                    });
                  }
                  form.insertBefore(imported, curAcoes);
                }

                for (const oldNode of nodesToRemove) {
                  oldNode.remove();
                }

                for (const code of scriptsParaExecutar) {
                  if (!code || !code.trim()) continue;
                  if (/executarJS\d+/i.test(code) || /form\.submit\s*\(/i.test(code)) continue;
                  try { window.eval(code); } catch (eEval) {}
                }
              } else {
                // Injeção pontual caso a estrutura de irmãos difira
                const refNode = curAcoes || null;
                ['divResultado', 'fldOpcoesAvancadas', 'fldAlterarLocalizadores'].forEach(idSec => {
                  const secDoc = doc.getElementById(idSec);
                  if (secDoc && !document.getElementById(idSec)) {
                    const imp = document.importNode(secDoc, true);
                    if (imp.querySelectorAll) imp.querySelectorAll('script').forEach(s => s.remove());
                    if (refNode && refNode.parentNode === form) {
                      form.insertBefore(imp, refNode);
                    } else {
                      form.appendChild(imp);
                    }
                  }
                });
              }

              window._eprocUltimoEventoIntimacaoCarregado = String(idEvento);
              addLog(`✓ Opções Avançadas e Gerenciar Localizadores carregados do servidor.`, 'info');
            }
          }
        } catch (errFetch) {
          console.warn('[eproc Intimações] Aviso ao buscar seções do evento via fetch:', errFetch);
        }
      }
    }

    // Garante 100% que #fldOpcoesAvancadas e #fldAlterarLocalizadores existam no DOM e tenham opções
    await garantirEstruturaDomOpcoesAvancadasELocalizadores();

    // Desativa novamente qualquer listener change que tenha vindo no novo #selEventoJudicial
    const selEvNovo = document.getElementById('selEventoJudicial');
    if (selEvNovo) {
      selEvNovo.value = String(idEvento);
      Array.from(selEvNovo.options).forEach(o => { o.selected = (String(o.value) === String(idEvento)); });
      if (window.jQuery) {
        try { window.jQuery(selEvNovo).off('change'); } catch (e) {}
      }
    }

    // Garante visibilidade plena de Opções Avançadas e Gerenciar Localizadores
    ['divResultado', 'fldOpcoesAvancadas', 'conteudoAcoesNoProcesso', 'fldAlterarLocalizadores', 'conteudoAlterarLocalizadores'].forEach(idVis => {
      const elVis = document.getElementById(idVis);
      if (elVis) {
        elVis.style.display = 'block';
        elVis.style.visibility = 'visible';
      }
    });
    const divAguardando = document.getElementById('divAguardandoIntimacaoBloco');
    if (divAguardando) divAguardando.style.display = 'none';

    const hdnCrim = document.getElementById('hdnOrgaoCompetenciaCriminal');
    if (hdnCrim && hdnCrim.value === 'S') {
      if (typeof window.habilitarCamposTipoParteCriminal === 'function') {
        try { window.habilitarCamposTipoParteCriminal(); } catch (e) {}
      }
    } else {
      if (typeof window.habilitarCamposTipoParteNaoCriminal === 'function') {
        try { window.habilitarCamposTipoParteNaoCriminal(); } catch (e) {}
      }
    }

    window._eprocUltimoEventoIntimacaoCarregado = String(idEvento);
    return true;
  }

  // [v3.5.5] Preenche prazo e marca checkbox de parte/polo sem usar .trigger('click') (que desmarcaria o checkbox e limparia o prazo!)
  function preencherPrazoParteIntimacao(txtId, chkId, fnKeyUp, fnChangeTxt, fnChangeChk, labelLog, valorPrazo) {
    if (!valorPrazo || String(valorPrazo).trim() === '' || String(valorPrazo).trim() === '-') return false;
    const valStr = String(valorPrazo).trim();
    const txtEl = document.getElementById(txtId);
    const chkEl = document.getElementById(chkId);

    // 1. Marca o checkbox PRIMEIRO para que onChangeChkSel* nunca veja o checkbox desmarcado e apague o texto
    if (chkEl) {
      chkEl.disabled = false;
      chkEl.checked = true;
      chkEl.setAttribute('checked', 'checked');
      if (window.jQuery) {
        try { window.jQuery(chkEl).prop('disabled', false).prop('checked', true); } catch (e) {}
      }
    }

    // 2. Preenche o campo de prazo em dias
    if (txtEl) {
      destacarCampoAtivo(txtEl, `Prazo ${labelLog}`, `${valStr} dias`);
      txtEl.disabled = false;
      txtEl.readOnly = false;
      txtEl.value = valStr;
      txtEl.setAttribute('value', valStr);
      if (window.jQuery) {
        try {
          window.jQuery(txtEl).prop('disabled', false).prop('readonly', false).val(valStr).trigger('input').trigger('keyup').trigger('change');
        } catch (e) {}
      } else {
        dispararEventos(txtEl, ['input', 'keyup', 'change', 'blur']);
      }
      if (fnKeyUp && typeof window[fnKeyUp] === 'function') {
        try { window[fnKeyUp](); } catch (e) {}
      }
      if (fnChangeTxt && typeof window[fnChangeTxt] === 'function') {
        try { window[fnChangeTxt](); } catch (e) {}
      }
    }

    // 3. Confirma o checkbox marcado e dispara apenas 'change' (NUNCA 'click')
    if (chkEl) {
      destacarCampoAtivo(chkEl, `Marcar ${labelLog}`, 'Marcado');
      chkEl.disabled = false;
      chkEl.checked = true;
      chkEl.setAttribute('checked', 'checked');
      if (window.jQuery) {
        try {
          window.jQuery(chkEl).prop('disabled', false).prop('checked', true).trigger('change');
        } catch (e) {}
      } else {
        dispararEventos(chkEl, ['change']);
      }
      if (fnChangeChk && typeof window[fnChangeChk] === 'function') {
        try { window[fnChangeChk](); } catch (e) {}
      }
      // Garantia final pós-handlers do eproc
      chkEl.checked = true;
    }

    if (txtEl && txtEl.value !== valStr) {
      txtEl.value = valStr;
    }

    addLog(`✓ ${labelLog}: Prazo preenchido com ${valStr} dias e opção marcada.`, 'info');
    return true;
  }

  async function executarDiagnosticoPreVooIntimacoes() {
    addLog('🧪 Iniciando Verificação Prévia de Auditoria do Módulo de Intimações...', 'info');

    if (!ehTelaDeIntimacao()) {
      addLog('❌ Tela atual não é de Intimação Eletrônica (processo_intimacao).', 'error');
      alertOriginal.call(window, 'Acesse a tela de "Intimação Eletrônica" de um processo para validar as preferências deste módulo.');
      return false;
    }

    const selEvento = document.getElementById('selEventoJudicial');
    if (!selEvento) {
      addLog('❌ Elemento #selEventoJudicial não encontrado na página.', 'error');
      return false;
    }

    const eventosDisponiveis = Array.from(selEvento.options)
      .filter(o => o.value && o.value !== 'null')
      .map(o => ({ value: String(o.value).trim(), texto: o.text.trim(), norm: normalizar(o.text) }));

    addLog(`✓ ${eventosDisponiveis.length} evento(s) judicial(is) mapeado(s) na combo.`, 'info');

    const itens = itensCarregados || [];
    let faltantes = 0;
    for (const item of itens) {
      const codEv = String(item.codigoEvento || '').trim();
      const normEv = normalizar(item.evento);
      const match = (codEv && eventosDisponiveis.find(e => e.value === codEv)) ||
                    eventosDisponiveis.find(e => e.norm === normEv || e.norm.includes(normEv) || normEv.includes(e.norm));
      if (!match) {
        addLog(`⚠️ Item #${item.num} ("${item.nome}"): Evento "${item.evento}" (${codEv || 'sem cód.'}) não encontrado no catálogo da tela!`, 'warn');
        faltantes++;
      } else {
        addLog(`✓ Item #${item.num} ("${item.nome}"): Evento [${match.value}] "${match.texto}" validado.`, 'info');
      }
    }

    if (faltantes === 0) {
      addLog('✅ Todos os eventos da planilha constam no catálogo do eproc!', 'success');
    } else {
      addLog(`⚠️ Atenção: ${faltantes} evento(s) da planilha não foram localizados no catálogo nativo.`, 'warn');
    }

    // Validação de Localizadores contra o catálogo da Unidade
    try {
      const catLocs = await obterOuCarregarCatalogoLocalizadoresUnidade();
      addLog(`✓ ${catLocs.length} localizador(es) da Unidade mapeados para auditoria.`, 'info');
      for (const item of itens) {
        if (item.novoLocalizador && item.novoLocalizador !== '-' && !normalizar(item.novoLocalizador).includes('manter')) {
          const matchLoc = catLocs.find(c => normalizar(c.text).includes(normalizar(item.novoLocalizador)) || normalizar(item.novoLocalizador).includes(normalizar(c.text)));
          if (matchLoc) {
            addLog(`✓ Item #${item.num} ("${item.nome}"): Novo localizador "${matchLoc.text}" (ID: ${matchLoc.value}) validado.`, 'info');
          } else {
            addLog(`⚠️ Item #${item.num} ("${item.nome}"): Novo localizador "${item.novoLocalizador}" não encontrado no catálogo da Unidade.`, 'warn');
          }
        }
        if (item.locDesativar && item.locDesativar !== '-' && !normalizar(item.locDesativar).includes('nao remover')) {
          addLog(`ℹ️ Item #${item.num} ("${item.nome}"): Localizador(es) a desativar: "${item.locDesativar}".`, 'info');
        }
      }
    } catch (eLocDiag) {}

    return true;
  }

  async function executarPassoAPassoIntimacao(item) {
    if (window._eprocPararLote) throw new Error('PARADA_SOLICITADA');

    ultimoAvisoEproc = '';
    gravacaoEmAndamento = true;
    window._eprocItemAtual = null;
    window._eprocItemIntimacaoAtual = null;

    resetarFormularioIntimacao();
    await sleep(150);

    const dados = {
      linha: item.linha,
      nome: item.nome,
      tipoPref: item.tipo || 'Unidade',
      grupo: item.grupo || '(Nenhum)',
      acaoPref: item.acaoPreferencial ? 'Marcada' : 'Não marcada',
      evento: item.evento,
      codigoEvento: item.codigoEvento || '',
      modoPrazos: item.modoPrazos || 'Por Polo',
      prazoMP: item.prazoMP || '',
      prazoAutores: item.prazoAutores || '',
      prazoReus: item.prazoReus || '',
      prazoEspEnt: item.prazoEspEnt || '',
      prazoSimpDemais: item.prazoSimpDemais || '',
      urgente: !!item.urgente,
      comportamento: item.comportamentoLoc || 'NÃO remover de localizador algum',
      locPrincipal: item.novoLocalizador || '',
      locPrincipalFallback: false,
      locDesativar: item.locDesativar || '',
      sucesso: false
    };

    const aplicarCamposCabecalhoPreferenciaIntimacao = () => {
      if (typeof window.exibirFormPreferencias === 'function') {
        try { window.exibirFormPreferencias('salvar'); } catch (e) {}
      } else {
        const btnSalvar = document.getElementById('btnSalvarPreferencias');
        if (btnSalvar) dispararClique(btnSalvar);
      }
      if (typeof window.exibeOcultaItens === 'function') {
        try { window.exibeOcultaItens(false); } catch (e) {}
      }
      const divOpcoes = document.getElementById('divPrefOpcoes');
      if (divOpcoes) divOpcoes.style.display = 'block';
      const hdnAcao = document.getElementById('hdnAcaoPreferencia');
      if (hdnAcao) hdnAcao.value = 'salvar';
      const hdnPref = document.getElementById('hdnPreferencia');
      if (hdnPref) hdnPref.value = '';

      // Nome da Preferência (#txtDescricaoCadastro)
      const txtDescricaoCadastro = document.getElementById('txtDescricaoCadastro');
      if (!txtDescricaoCadastro) throw new Error('Campo txtDescricaoCadastro não encontrado na tela de Intimação Eletrônica.');
      destacarCampoAtivo(txtDescricaoCadastro, 'Nome da Preferência', item.nome);
      txtDescricaoCadastro.disabled = false;
      txtDescricaoCadastro.value = item.nome;
      dispararEventos(txtDescricaoCadastro, ['input', 'change', 'blur']);

      // Tipo de Preferência (#rdUnidade / #rdIndividual)
      if (window.jQuery) {
        window.jQuery('input[name=rdPrefTipo]').prop('disabled', false);
      }
      const usarIndividual = normalizar(item.tipo) === 'individual';
      const rdTipoAlvo = document.getElementById(usarIndividual ? 'rdIndividual' : 'rdUnidade');
      if (rdTipoAlvo) {
        rdTipoAlvo.disabled = false;
        rdTipoAlvo.checked = true;
        dispararEventos(rdTipoAlvo, ['change', 'click']);
      }

      // Grupo de Preferência (#selFormularioPersonalizacaoGrupo)
      const selGrupoEl = document.getElementById('selFormularioPersonalizacaoGrupo');
      const temGrupoDefinido = !!(item.grupo && String(item.grupo).trim() !== '' && String(item.grupo).trim() !== '-' && normalizar(item.grupo) !== 'nenhum');
      if (selGrupoEl) {
        if (temGrupoDefinido) {
          const optMatch = Array.from(selGrupoEl.options).find(o => normalizar(o.text) === normalizar(item.grupo));
          if (optMatch) {
            selGrupoEl.disabled = false;
            selGrupoEl.value = optMatch.value;
            optMatch.selected = true;
          }
        } else {
          let optNull = Array.from(selGrupoEl.options).find(o => o.value === 'null' || o.value === '');
          if (optNull) {
            Array.from(selGrupoEl.options).forEach(o => { o.selected = (o === optNull); });
            selGrupoEl.value = optNull.value;
          }
        }
      }

      // Radio "Como salvar seleção de localizadores": (#rdIndividuais, #rdMarcarTodos, #rdDesmarcarTodos)
      if (window.jQuery) {
        window.jQuery('input[name=rdPrefLocalizadores]').prop('disabled', false);
      }
      const radioLocId = item.rdPrefLocalizadores === 'M' ? 'rdMarcarTodos' : (item.rdPrefLocalizadores === 'D' ? 'rdDesmarcarTodos' : 'rdIndividuais');
      const rdLoc = document.getElementById(radioLocId) || document.getElementById('rdIndividuais');
      if (rdLoc) {
        rdLoc.disabled = false;
        rdLoc.checked = true;
        dispararEventos(rdLoc, ['change', 'click']);
      }

      // Opções: Ação Preferencial e Marcar como Padrão
      const chkMovPref = document.getElementById('chkMovPreferencial');
      if (chkMovPref) {
        chkMovPref.disabled = false;
        chkMovPref.checked = !!item.acaoPreferencial;
        dispararEventos(chkMovPref, ['change']);
      }
      const chkPadrao = document.getElementById('chkValorPadrao');
      if (chkPadrao) {
        chkPadrao.disabled = false;
        chkPadrao.checked = !!item.padrao;
        dispararEventos(chkPadrao, ['change']);
      }
    };

    try {
      // PASSOS 1 e 2: Abre Preferências e marca Unidade, Localizadores selecionados, Ação Preferencial e Descrição
      aplicarCamposCabecalhoPreferenciaIntimacao();
      await sleep(150);

      // PASSO 3: Selecionar Evento de citação/intimação (#selEventoJudicial) e carregar Opções Avançadas + Localizadores
      let selEvento = document.getElementById('selEventoJudicial');
      let idEventoSelecionado = '';
      if (selEvento) {
        if (window.jQuery) {
          try { window.jQuery(selEvento).off('change'); } catch (e) {}
        }

        let optEvento = null;

        // 1ª Prioridade Absoluta: Busca pelo Código do Evento se informado na planilha
        if (item.codigoEvento && /^\d+$/.test(String(item.codigoEvento).trim())) {
          optEvento = Array.from(selEvento.options).find(o => String(o.value).trim() === String(item.codigoEvento).trim());
        }

        // 2ª Prioridade: Busca pelo texto oficial do evento
        if (!optEvento && item.evento && item.evento !== '-' && item.evento.length >= 4) {
          const normEvento = normalizar(item.evento);

          optEvento = Array.from(selEvento.options).find(o => {
            if (!o.value || o.value === 'null') return false;
            return normalizar(o.text) === normEvento;
          });

          if (!optEvento) {
            optEvento = Array.from(selEvento.options).find(o => {
              if (!o.value || o.value === 'null') return false;
              const oNorm = normalizar(o.text);
              return oNorm.includes(normEvento) || normEvento.includes(oNorm);
            });
          }

          if (!optEvento && (normEvento.includes('vista ao mp') || normEvento.includes('parecer'))) {
            optEvento = Array.from(selEvento.options).find(o => {
              if (!o.value || o.value === 'null') return false;
              const oNorm = normalizar(o.text);
              return oNorm.includes('vista ao mp') || (oNorm.includes('mp') && oNorm.includes('parecer'));
            });
          }
        }

        if (optEvento) {
          selEvento.value = optEvento.value;
          optEvento.selected = true;
          idEventoSelecionado = String(optEvento.value).trim();
          dados.evento = optEvento.text.trim();
          dados.codigoEvento = idEventoSelecionado;
          destacarCampoAtivo(selEvento, 'Evento Judicial', `[${idEventoSelecionado}] ${dados.evento}`);
          addLog(`✓ Passo 3: Evento de citação/intimação selecionado: [${idEventoSelecionado}] ${dados.evento}`, 'info');

          // Carrega #fldOpcoesAvancadas e #fldAlterarLocalizadores sem recarregar a página
          await carregarSecoesEventoIntimacaoSemReload(idEventoSelecionado);
          await sleep(250);

          // Reafirma os campos do cabeçalho de Preferências após a injeção das seções
          aplicarCamposCabecalhoPreferenciaIntimacao();
        } else {
          throw new Error(`Evento "${item.evento || item.codigoEvento}" não encontrado na combo selEventoJudicial.`);
        }
      } else {
        throw new Error('Combo #selEventoJudicial não encontrada na tela.');
      }

      // Aguarda qualquer indicador de carregamento do eproc finalizar
      await esperarCond(() => {
        const sp1 = document.getElementById('aguardandoCarregandoEventosDoc');
        const sp2 = document.getElementById('imgLoadingEventoEncadeadoCitacaoIntimacao');
        const sp3 = document.getElementById('divLoadingEventoJudicialPrazo');
        const ok1 = !sp1 || sp1.style.display === 'none' || !sp1.offsetParent;
        const ok2 = !sp2 || sp2.style.display === 'none' || !sp2.offsetParent;
        const ok3 = !sp3 || sp3.style.visibility === 'hidden' || sp3.style.display === 'none' || !sp3.offsetParent;
        return ok1 && ok2 && ok3;
      }, 4000);

      // PASSO 4: Garantir Opções Avançadas aberto e selecionar "Por Pólo" ou "Por Tipo de Parte"
      const fldOpAv = document.getElementById('fldOpcoesAvancadas');
      const contOpAv = document.getElementById('conteudoAcoesNoProcesso');
      if (fldOpAv) fldOpAv.style.display = 'block';
      if (contOpAv && contOpAv.style.display === 'none') {
        if (typeof window.infraAbrirFecharElementoHTML === 'function') {
          try { window.infraAbrirFecharElementoHTML('conteudoAcoesNoProcesso', 'imgStatusConteudoAcoesNoProcesso'); } catch (e) {}
        }
        contOpAv.style.display = 'block';
      }

      const modoPolo = item.normModoPrazos.includes('polo') || (!item.normModoPrazos.includes('tipo') && !item.normModoPrazos.includes('parte'));
      const modoTipoParte = !modoPolo;

      if (modoPolo) {
        // Ativa "Por Pólo" antes de preencher os prazos (evita que limparCamposPreferenciaPorPolo apague os prazos depois)
        if (typeof window.checkPorPolo === 'function') {
          try { window.checkPorPolo(true); } catch (e) {}
        }
        const rdPolo = document.getElementById('porPolo');
        const rdTipo = document.getElementById('porTipoDeParte');
        if (rdTipo) {
          rdTipo.checked = false;
          rdTipo.removeAttribute('checked');
        }
        if (rdPolo) {
          rdPolo.disabled = false;
          rdPolo.checked = true;
          rdPolo.setAttribute('checked', 'checked');
          destacarCampoAtivo(rdPolo, 'Opções Avançadas', 'Por Pólo');
        }
        if (window.jQuery) {
          try {
            window.jQuery('#porTipoDeParte').prop('checked', false);
            window.jQuery('#porPolo').prop('checked', true);
            window.jQuery('.tipoParte').css('display', 'none');
            window.jQuery('.porPolo').css('display', 'block');
          } catch (e) {}
        } else {
          document.querySelectorAll('.tipoParte').forEach(el => { el.style.display = 'none'; });
          document.querySelectorAll('.porPolo').forEach(el => { el.style.display = 'block'; });
        }
        addLog('✓ Passo 4: Opções Avançadas aberto e modo "Por Pólo" selecionado.', 'info');
        await sleep(200);

        // PASSO 5: Preencher os prazos de acordo com a parte (Por Pólo)
        preencherPrazoParteIntimacao('txtPrazoMPF', 'chkSelMPF', 'onKeyUpTxtPrazoMPF', 'onChangeTxtPrazoMPF', 'onChangeChkSelMPF', 'MP (Custos iuris)', item.prazoMP);
        preencherPrazoParteIntimacao('txtPrazoAutores', 'chkSelPrazoAutores', 'onKeyUpTxtPrazoAutores', 'onChangeTxtPrazoAutores', 'onChangeChkSelPrazoAutores', 'Polo Ativo (Autores)', item.prazoAutores);
        preencherPrazoParteIntimacao('txtPrazoReus', 'chkSelPrazoReus', 'onKeyUpTxtPrazoReus', 'onChangeTxtPrazoReus', 'onChangeChkSelPrazoReus', 'Polo Passivo (Réus)', item.prazoReus);
        preencherPrazoParteIntimacao('txtPrazoInteressados', 'chkSelPrazoInteressados', 'onKeyUpTxtPrazoInteressados', 'onChangeTxtPrazoInteressados', 'onChangeChkSelPrazoInteressados', 'Terceiro/Interessado', item.prazoInteressados);
      } else if (modoTipoParte) {
        if (typeof window.checkTipoDeParte === 'function') {
          try { window.checkTipoDeParte(true); } catch (e) {}
        }
        const rdTipo = document.getElementById('porTipoDeParte');
        const rdPolo = document.getElementById('porPolo');
        if (rdPolo) {
          rdPolo.checked = false;
          rdPolo.removeAttribute('checked');
        }
        if (rdTipo) {
          rdTipo.disabled = false;
          rdTipo.checked = true;
          rdTipo.setAttribute('checked', 'checked');
          destacarCampoAtivo(rdTipo, 'Opções Avançadas', 'Por Tipo de Parte');
        }
        if (window.jQuery) {
          try {
            window.jQuery('#porPolo').prop('checked', false);
            window.jQuery('#porTipoDeParte').prop('checked', true);
            window.jQuery('.porPolo').css('display', 'none');
            window.jQuery('.tipoParte').css('display', 'block');
          } catch (e) {}
        } else {
          document.querySelectorAll('.porPolo').forEach(el => { el.style.display = 'none'; });
          document.querySelectorAll('.tipoParte').forEach(el => { el.style.display = 'block'; });
        }
        addLog('✓ Passo 4: Opções Avançadas aberto e modo "Por Tipo de Parte" selecionado.', 'info');
        await sleep(200);

        // PASSO 5: Preencher os prazos de acordo com a parte (Por Tipo de Parte)
        preencherPrazoParteIntimacao('txtPrazoEntPrazoEspecial', 'chkSelEntPrazoEspecial', 'onKeyUpTxtPrazoEntPrazoEspecial', 'onChangeTxtPrazoEntPrazoEspecial', 'onChangeChkSelEntPrazoEspecial', 'Entidades c/ Prazo Especial', item.prazoEspEnt);
        preencherPrazoParteIntimacao('txtPrazoEntPrazoSimples', 'chkSelEntPrazoSimples', 'onKeyUpTxtPrazoEntPrazoSimples', 'onChangeTxtPrazoEntPrazoSimples', 'onChangeChkSelEntPrazoSimples', 'Entidades c/ Prazo Simples', item.prazoSimpEnt);
        preencherPrazoParteIntimacao('txtPrazoNaoEntPrazoSimples', 'chkSelNaoEntPrazoSimples', 'onKeyUpTxtPrazoNaoEntPrazoSimples', 'onChangeTxtPrazoNaoEntPrazoSimples', 'onChangeChkSelNaoEntPrazoSimples', 'Partes c/ Prazo Simples', item.prazoSimpDemais);
        preencherPrazoParteIntimacao('txtPrazoDPU', 'chkSelDPU', 'onKeyUpTxtPrazoDPU', 'onChangeTxtPrazoDPU', 'onChangeChkSelDPU', 'DPU', item.prazoDPU);
      }

      // Garante que txtPrazoIgual fique vazio para não sobrescrever todas as partes ao carregar a preferência
      const txtPrazoIgual = document.getElementById('txtPrazoIgual');
      if (txtPrazoIgual) txtPrazoIgual.value = '';

      // Intimação Urgente
      const chkUrg = document.getElementById('chkIntimacaoUrgente');
      if (chkUrg) {
        chkUrg.checked = !!item.urgente;
        dispararEventos(chkUrg, ['change']);
      }

      // PASSO 6: Preencher Localizador Destino (Novo localizador: #selNovoLocalizador) e Localizadores a Desativar
      const fldLoc = document.getElementById('fldAlterarLocalizadores');
      const contLoc = document.getElementById('conteudoAlterarLocalizadores');
      if (fldLoc) fldLoc.style.display = 'block';
      if (contLoc) contLoc.style.display = 'block';

      let idNovoLocalizadorSelecionado = '';
      const selNovoLoc = document.getElementById('selNovoLocalizador');
      const querNovoLoc = !!(item.novoLocalizador && item.novoLocalizador !== '-' && !normalizar(item.novoLocalizador).includes('manter'));

      if (selNovoLoc) {
        if (querNovoLoc) {
          let optLoc = acharOpcaoLocalizador(selNovoLoc, item.novoLocalizador, false) ||
                       acharOpcaoLocalizador(selNovoLoc, item.novoLocalizador, true);

          if (!optLoc) {
            // Tenta buscar no catálogo geral e injetar a option caso não existisse ainda
            const cat = await obterOuCarregarCatalogoLocalizadoresUnidade();
            const matchCat = cat.find(c => normalizar(c.text).includes(normalizar(item.novoLocalizador)) || normalizar(item.novoLocalizador).includes(normalizar(c.text)));
            if (matchCat) {
              optLoc = document.createElement('option');
              optLoc.value = matchCat.value;
              optLoc.text = matchCat.text;
              selNovoLoc.appendChild(optLoc);
            }
          }

          if (optLoc && optLoc.value && optLoc.value !== 'null') {
            Array.from(selNovoLoc.options).forEach(o => { o.selected = (o === optLoc); });
            selNovoLoc.value = optLoc.value;
            optLoc.selected = true;
            idNovoLocalizadorSelecionado = String(optLoc.value).trim();
            dados.locPrincipal = optLoc.text.trim();
            destacarCampoAtivo(selNovoLoc, 'Novo Localizador (Destino)', optLoc.text.trim());
            dispararEventos(selNovoLoc, ['change']);
            addLog(`✓ Passo 6: Novo localizador selecionado: "${optLoc.text.trim()}" (ID: ${idNovoLocalizadorSelecionado})`, 'info');
          } else {
            dados.locPrincipal = `⚠️ "${item.novoLocalizador}" não encontrado no catálogo da Unidade`;
            dados.locPrincipalFallback = true;
            addLog(`⚠️ Localizador destino "${item.novoLocalizador}" não encontrado na Unidade.`, 'warn');
          }
        } else {
          selNovoLoc.value = 'null';
          Array.from(selNovoLoc.options).forEach(o => { o.selected = (o.value === 'null'); });
          idNovoLocalizadorSelecionado = '';
          dados.locPrincipal = 'MANTER LOCALIZADOR ATUAL';
        }
      }

      // Localizadores a Desativar (#selLocalizadorDesativar)
      const selDesativar = document.getElementById('selLocalizadorDesativar');
      const arrIdsDesativar = [];
      if (selDesativar) {
        Array.from(selDesativar.options).forEach(o => {
          o.selected = false;
          o.removeAttribute('selected');
        });
        if (window.$) {
          try { window.$('#selLocalizadorDesativar option').prop('selected', false); } catch (e) {}
        }

        const querDesativar = !!(item.locDesativar && item.locDesativar !== '-' && !normalizar(item.locDesativar).includes('nao remover') && !normalizar(item.locDesativar).includes('nenhum'));
        if (querDesativar) {
          const alvos = item.locDesativar.split(/[;,]/).map(s => s.trim()).filter(Boolean);
          const desativadosNomes = [];

          for (const alvo of alvos) {
            let optD = acharOpcaoLocalizador(selDesativar, alvo, false) || acharOpcaoLocalizador(selDesativar, alvo, true);
            if (!optD && selNovoLoc) {
              const optRef = acharOpcaoLocalizador(selNovoLoc, alvo, false) || acharOpcaoLocalizador(selNovoLoc, alvo, true);
              if (optRef && optRef.value && optRef.value !== 'null') {
                optD = document.createElement('option');
                optD.value = optRef.value;
                optD.text = optRef.text;
                selDesativar.appendChild(optD);
              }
            }
            if (optD && optD.value && optD.value !== 'null') {
              optD.selected = true;
              optD.setAttribute('selected', 'selected');
              if (!arrIdsDesativar.includes(String(optD.value).trim())) {
                arrIdsDesativar.push(String(optD.value).trim());
                desativadosNomes.push(optD.text.trim());
              }
            }
          }

          if (window.$) {
            try {
              window.$('#selLocalizadorDesativar').val(arrIdsDesativar);
              window.$('#selLocalizadorDesativar').trigger('change');
            } catch (e) {}
          }

          dados.locDesativar = desativadosNomes.length > 0 ? desativadosNomes.join('; ') : '(Nenhum encontrado)';
          addLog(`✓ Passo 6: Localizador(es) a desativar marcado(s): ${dados.locDesativar} (IDs: ${arrIdsDesativar.join(', ')})`, 'info');
        } else {
          dados.locDesativar = '(Nenhum - NÃO remover de localizador algum)';
        }
      }

      // Encadeamento
      const chkEnc = document.getElementById('chkEncadeamentoIntimar');
      if (chkEnc) {
        chkEnc.checked = !!item.encadeamentoIntimacao;
        dispararEventos(chkEnc, ['change']);
      }

      // Reafirmação final de todos os campos antes de clicar em #btnOK
      aplicarCamposCabecalhoPreferenciaIntimacao();
      if (modoPolo) {
        const rdPoloFim = document.getElementById('porPolo');
        const rdTipoFim = document.getElementById('porTipoDeParte');
        if (rdTipoFim) rdTipoFim.checked = false;
        if (rdPoloFim) rdPoloFim.checked = true;
        if (item.prazoMP && item.prazoMP !== '-') {
          const txtMP = document.getElementById('txtPrazoMPF');
          const chkMP = document.getElementById('chkSelMPF');
          if (txtMP) txtMP.value = String(item.prazoMP).trim();
          if (chkMP) chkMP.checked = true;
        }
      }

      // Contexto ativo para garantia absoluta no hook gravarPreferencias(listaDados)
      window._eprocItemIntimacaoAtual = {
        item,
        idEventoSelecionado,
        idNovoLocalizadorSelecionado,
        arrIdsDesativar,
        sinLocalizadores: 'L',
        modoPolo,
        modoTipoParte
      };

      instalarHookGravarPreferencias();
      await sleep(200);

      // PASSO 7: Gravação da Preferência (#btnOK / validarPreferencias)
      const btnOK = document.getElementById('btnOK');
      if (btnOK) {
        btnOK.disabled = false;
        destacarCampoAtivo(btnOK, 'Salvar Preferência', `Gravando: ${item.nome}`);
        dispararClique(btnOK);
      } else if (typeof window.validarPreferencias === 'function') {
        window.validarPreferencias();
      }

      let aguardouSave = 0;
      while (aguardouSave < 5000) {
        if (window._eprocPararLote) break;
        await sleep(250);
        aguardouSave += 250;
        if (ultimoAvisoEproc) {
          const avisoNorm = normalizar(ultimoAvisoEproc);
          if (avisoNorm.includes('cadastrada') || avisoNorm.includes('atualizada') || avisoNorm.includes('sucesso')) {
            break;
          }
          if (avisoNorm.includes('erro') || avisoNorm.includes('ja existe') || avisoNorm.includes('mesma descricao')) {
            break;
          }
        }
        if (btnOK && !btnOK.disabled && aguardouSave > 1200) {
          break;
        }
      }

      if (ultimoAvisoEproc) {
        const avisoNorm = normalizar(ultimoAvisoEproc);
        if (avisoNorm.includes('ja existe') || avisoNorm.includes('mesma descricao')) {
          throw new Error('DUPLICADA: ' + ultimoAvisoEproc);
        }
        if (avisoNorm.includes('erro') || avisoNorm.includes('falha') || avisoNorm.includes('nao foi possivel') || avisoNorm.includes('informe a descricao')) {
          throw new Error(ultimoAvisoEproc);
        }
      }

      addLog(`✅ Preferência de Intimação gravada com sucesso: "${item.nome}"`, 'success');
      dados.sucesso = true;
      return dados;
    } finally {
      window._eprocItemIntimacaoAtual = null;
      removerDestaqueCampo();
      gravacaoEmAndamento = false;
    }
  }

  async function executarDiagnosticoPreVoo() {

    if (moduloAtivo === 'relatorios') {

      return await executarDiagnosticoPreVooRelatorios();

    }

    if (moduloAtivo === 'movimentacoes') {

      return await executarDiagnosticoPreVooMovimentacoes();

    }

    if (moduloAtivo === 'area_minutas') {

      return await executarDiagnosticoPreVooAreaMinutas();

    }

    if (moduloAtivo === 'intimacoes') {

      return await executarDiagnosticoPreVooIntimacoes();

    }

    return await executarDiagnosticoPreVooMinutas();

  }



  async function executarDiagnosticoPreVooMinutas() {

    if (!itensCarregados || itensCarregados.length === 0) {

      alertOriginal.call(window, 'Carregue primeiro uma planilha Excel (.xlsx) antes de executar a verificação prévia.');

      return;

    }



    window._eprocInicioAuditoriaPreviaMs = Date.now();



    const btnDiag = document.getElementById('btn-rito-diagnostico');

    const btnIni = document.getElementById('btn-rito-iniciar');

    if (btnDiag) {

      btnDiag.disabled = true;

      btnDiag.innerHTML = '<span>⏳</span> Verificando (0%)...';

    }

    if (btnIni) btnIni.disabled = true;



    addLog('🔍 Iniciando Verificação prévia da planilha...');

    atualizarProgressoDiagnostico(5, 'Etapa 1/4', '1. Varrendo Localizadores da Unidade...', true);

    await sleep(60);



    const selNovo = document.getElementById('selNovoLocalizador') || document.getElementById('selLocalizador');

    const selSec = document.getElementById('selLocalizadorSecundario') || document.getElementById('selOpcaoLocalizador');

    const optsPrincipal = selNovo ? Array.from(selNovo.options) : [];

    const optsSecundario = selSec ? Array.from(selSec.options) : optsPrincipal;



    const locResultados = [];

    let locTotalPerfeitos = 0;

    let locTotalComFallback = 0;



    for (const item of itensCarregados) {

      const locP = item.localizadores && item.localizadores[0] ? item.localizadores[0] : null;

      const locsS = item.localizadores && item.localizadores.length > 1 ? item.localizadores.slice(1) : [];



      let principalOk = false;

      let optPEncontrado = null;

      if (locP) {

        optPEncontrado = acharOpcaoLocalizador(optsPrincipal, locP, false);

        principalOk = !!optPEncontrado;

      } else {

        principalOk = true;

      }



      const secStatus = [];

      let secTodosOk = true;

      for (const sec of locsS) {

        const optSEncontrado = acharOpcaoLocalizador(optsSecundario, sec, false);

        if (optSEncontrado) {

          secStatus.push({ nome: sec, ok: true, optTexto: optSEncontrado.text.trim() });

        } else {

          secTodosOk = false;

          secStatus.push({ nome: sec, ok: false, fallback: 'BAIXADOS - BAIXADOS' });

        }

      }



      const precisaFallback = !principalOk || !secTodosOk;

      if (precisaFallback) locTotalComFallback++;

      else locTotalPerfeitos++;



      locResultados.push({

        num: item.num,

        linha: item.linha,

        nome: item.nome,

        locPrincipal: locP,

        principalOk: principalOk,

        principalOptTexto: optPEncontrado ? optPEncontrado.text.trim() : null,

        principalFallback: !principalOk ? 'ARQUIVO - ARQUIVO' : null,

        locsSecundarios: locsS,

        secStatus: secStatus,

        secTodosOk: secTodosOk,

        precisaFallback: precisaFallback

      });

    }



    // 2. VARREDURA DE MODELOS DA UNIDADE (progresso em tempo real de 15% a 78%)

    atualizarProgressoDiagnostico(15, 'Etapa 2/4', '2. Consultando Modelos de Documento no eproc...', true);

    await sleep(40);



    await escanearModelosDaUnidade(itensCarregados, (atual, total, desc) => {

      const pctMod = 15 + Math.round((atual / Math.max(1, total)) * 63);

      atualizarProgressoDiagnostico(pctMod, `Etapa 2/4 • ${atual}/${total}`, `Consultando no eproc: ${desc}`, true);

    });



    const modelosResultados = [];

    let modEspecificosOk = 0;

    let modUsaraoGenerico = 0;



    for (const item of itensCarregados) {

      const temModEspecifico = !!(item.modeloNome && item.modeloNome !== '-');

      const genObj = determinarModeloGenerico(item);

      let especificoExiste = false;

      let descModeloFinal = item.modeloGenericoFixo || genObj.nomeModelo;



      if (temModEspecifico) {

        const achou = localizarMelhorModeloEspecifico(item, []);



        if (achou) {

          especificoExiste = true;

          modEspecificosOk++;

          descModeloFinal = achou.descricao;

        } else {

          modUsaraoGenerico++;

        }

      } else {

        modUsaraoGenerico++;

      }



      modelosResultados.push({

        num: item.num,

        linha: item.linha,

        nome: item.nome,

        modeloEspecifico: temModEspecifico ? item.modeloNome : null,

        especificoExiste: especificoExiste,

        matrizGenerica: item.modeloGenericoFixo || genObj.nomeModelo,

        descModeloFinal: descModeloFinal

      });

    }



    // 3. VARREDURA DE EVENTOS DO SISTEMA (progresso em tempo real de 78% a 94%)

    atualizarProgressoDiagnostico(78, 'Etapa 3/4', '3. Consultando Catálogo de Eventos do eproc...', true);

    await sleep(40);



    const eventosMapa = new Map();

    for (const item of itensCarregados) {

      const cod = (item.eventoCod || '').trim();

      const nomeEv = (item.evento || '').trim();

      // Dados complementares NUNCA são eventos do sistema

      if (nomeEv.includes(':') || normalizar(nomeEv).includes('tutela:') || normalizar(nomeEv).includes('dado')) {

        continue;

      }

      const chave = cod || nomeEv;

      if (chave) {

        if (!eventosMapa.has(chave)) {

          eventosMapa.set(chave, {

            cod: cod,

            nomePlanilha: nomeEv,

            linhas: [item.linha],

            valido: false,

            eprocDescricao: ''

          });

        } else {

          eventosMapa.get(chave).linhas.push(item.linha);

        }

      }



      // Audita apenas eventos complementares reais (com código numérico ou formato oficial de evento eproc, NUNCA dados complementares)

      if (item.eventosComplementares && item.eventosComplementares.length > 0) {

        for (const comp of item.eventosComplementares) {

          const cCod = (comp.cod || '').trim();

          const cNome = (comp.nome || '').trim();

          if (cNome.includes(':') || normalizar(cNome).includes('tutela') || normalizar(cNome).includes('dado')) {

            continue; // Dados complementares não entram na auditoria de eventos

          }

          const cChave = cCod || cNome;

          if (cChave) {

            if (!eventosMapa.has(cChave)) {

              eventosMapa.set(cChave, {

                cod: cCod,

                nomePlanilha: cNome || `(Complementar ${cCod})`,

                linhas: [item.linha],

                valido: false,

                eprocDescricao: ''

              });

            } else {

              eventosMapa.get(cChave).linhas.push(item.linha);

            }

          }

        }

      }

    }



    let eventosValidos = 0;

    let eventosInvalidos = 0;

    let evIdx = 0;

    const totalEvs = Math.max(1, eventosMapa.size);



    for (const [chave, evInfo] of eventosMapa.entries()) {

      evIdx++;

      const termo = evInfo.cod || evInfo.nomePlanilha;

      const pctEv = 78 + Math.round((evIdx / totalEvs) * 16);

      atualizarProgressoDiagnostico(pctEv, `Etapa 3/4 • ${evIdx}/${totalEvs}`, `Validando evento: ${termo}`, true);

      const listaEvs = await obterEventosPorTermo(termo);



      let achouEv = null;

      if (evInfo.cod) {

        achouEv = listaEvs.find(e => e.id === evInfo.cod || (e.descricao && e.descricao.includes(`(${evInfo.cod})`)));

      }

      if (!achouEv && listaEvs.length > 0) {

        const nPlan = normalizar(evInfo.nomePlanilha);

        achouEv = listaEvs.find(e => {

          const ne = normalizar(e.descricao);

          return ne.includes(nPlan) || nPlan.includes(ne);

        });

      }



      if (achouEv) {

        evInfo.valido = true;

        evInfo.eprocDescricao = achouEv.descricao;

        eventosValidos++;

      } else if (listaEvs.length > 0) {

        evInfo.valido = true;

        evInfo.eprocDescricao = listaEvs[0].descricao;

        eventosValidos++;

      } else if (evInfo.cod && /^\d+$/.test(evInfo.cod)) {

        // Se possui código numérico válido e está no catálogo oficial TJSP

        evInfo.valido = true;

        evInfo.eprocDescricao = `${evInfo.nomePlanilha} (${evInfo.cod})`;

        eventosValidos++;

      } else {

        evInfo.valido = false;

        eventosInvalidos++;

      }

    }



    // 4. VARREDURA DE MATRIZES GENÉRICAS OBRIGATÓRIAS

    atualizarProgressoDiagnostico(96, 'Etapa 4/4', '4. Validando Matrizes Genéricas Obrigatórias...', true);

    await sleep(40);



    // Pré-carrega termos abrangentes para garantir que todas as matrizes estejam no pool:

    const termosMatrizes = [

      '***', '*', '*** DESP', '*** ACORD', '*** ATO', '*** MANDAD', '*** CARTA AR', '*** CARTA PREC', '*** PRECAT', '*** CERTID', 'DESP', 'ACORD', 'ATO', 'MANDAD', 'CARTA', 'PRECAT', 'PRECATÓRIA', 'CERTID'

    ];

    const poolMatrizes = new Map();

    for (const tm of termosMatrizes) {

      const listaM = await obterModelosPorTermo(tm);

      if (Array.isArray(listaM)) {

        for (const m of listaM) {

          if (m && m.id && !poolMatrizes.has(m.id)) {

            poolMatrizes.set(m.id, m);

          }

        }

      }

    }

    const listaModelosUnidade = Array.from(poolMatrizes.values());



    const matrizesObrigatorias = [

      { chave: 'despacho', label: '***DESPACHO/DECISÃO***' },

      { chave: 'sentenca', label: '***ACÓRDÃO***' },

      { chave: 'ato', label: '***ATO ORDINATÓRIO***' },

      { chave: 'mandado', label: '***MANDADO - CEMAN***' },

      { chave: 'carta', label: '***CARTA AR DIGITAL***' },

      { chave: 'precatoria', label: '***CARTA PRECATÓRIA***' },

      { chave: 'certidao', label: '***CERTIDÃO DE CARTÓRIO***' }

    ];



    const matrizesStatus = [];

    let totalMatrizesPresentes = 0;



    for (const mObj of matrizesObrigatorias) {

      const achouMatriz = identificarMatrizGenerica(listaModelosUnidade, mObj.chave);

      if (achouMatriz) {

        totalMatrizesPresentes++;

        matrizesStatus.push({ ...mObj, presente: true, encontrado: achouMatriz.descricao, id: achouMatriz.id });

      } else {

        matrizesStatus.push({ ...mObj, presente: false, encontrado: null, id: null });

      }

    }



    // 5. VARREDURA DE CLASSIFICAÇÕES DE MINUTAS (progresso de 93% a 99%)

    atualizarProgressoDiagnostico(93, 'Etapa 5/5', '5. Consultando Classificações de Minuta na Unidade...', true);

    await sleep(40);



    const mapaClassifsTabela = await carregarTodasClassificacoesDaTabela();



    const classifPlanilhaMapa = new Map();
    for (const item of itensCarregados) {
      const cNome = (item.classificacao || '').trim();
      if (!cNome || cNome === '-') continue;

      const partes = cNome.split(';').map(s => s.trim()).filter(s => s && s !== '-');
      for (const pNome of partes) {
        const chaveUpper = pNome.toUpperCase().trim();
        const chaveNorm = normalizar(pNome);
        const chaveKey = chaveUpper;

        if (!classifPlanilhaMapa.has(chaveKey)) {
          classifPlanilhaMapa.set(chaveKey, {
            nomeOriginal: pNome,
            chaveNorm: chaveNorm,
            chaveUpper: chaveUpper,
            linhas: [item.linha],
            itensCount: 1,
            presenteNaUnidade: false,
            idNaUnidade: null,
            textoNaUnidade: null,
            seraCadastradaAuto: false
          });
        } else {
          const obj = classifPlanilhaMapa.get(chaveKey);
          obj.linhas.push(item.linha);
          obj.itensCount++;
        }
      }
    }

    let classifPresentes = 0;
    let classifNovasACadastrar = 0;
    let idxCl = 0;
    const totalCls = Math.max(1, classifPlanilhaMapa.size);

    for (const [chaveKey, cInfo] of classifPlanilhaMapa.entries()) {
      idxCl++;
      const pctCl = 93 + Math.round((idxCl / totalCls) * 6);
      atualizarProgressoDiagnostico(pctCl, `Etapa 5/5 • ${idxCl}/${totalCls}`, `Auditando classificação: ${cInfo.nomeOriginal}`, true);

      let achou = null;
      if (cacheClassificacoesUnidade.has(cInfo.chaveUpper)) {
        achou = cacheClassificacoesUnidade.get(cInfo.chaveUpper);
      } else if (cacheClassificacoesUnidade.has(cInfo.chaveNorm)) {
        achou = cacheClassificacoesUnidade.get(cInfo.chaveNorm);
      } else if (mapaClassifsTabela.has(cInfo.chaveUpper)) {
        achou = mapaClassifsTabela.get(cInfo.chaveUpper);
      } else if (mapaClassifsTabela.has(cInfo.chaveNorm)) {
        achou = mapaClassifsTabela.get(cInfo.chaveNorm);
      } else {
        await buscarClassificacaoPorAjax(cInfo.nomeOriginal);
        if (cacheClassificacoesUnidade.has(cInfo.chaveUpper)) {
          achou = cacheClassificacoesUnidade.get(cInfo.chaveUpper);
        } else if (cacheClassificacoesUnidade.has(cInfo.chaveNorm)) {
          achou = cacheClassificacoesUnidade.get(cInfo.chaveNorm);
        }
      }



      if (achou && /^\d+$/.test(achou.id)) {

        cInfo.presenteNaUnidade = true;

        cInfo.idNaUnidade = achou.id;

        cInfo.textoNaUnidade = achou.text;

        classifPresentes++;

      } else {

        cInfo.presenteNaUnidade = false;

        cInfo.seraCadastradaAuto = true;

        classifNovasACadastrar++;

      }

    }



    const classifPlanilhaLista = Array.from(classifPlanilhaMapa.values());

    const todasClassifsUnidade = Array.from(

      new Map(Array.from(cacheClassificacoesUnidade.values()).map(item => [item.id, item])).values()

    ).sort((a, b) => a.text.localeCompare(b.text));



    const diagnosticoResultado = {

      timestamp: new Date().toLocaleTimeString('pt-BR'),

      dataCompleta: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR'),

      totalItens: itensCarregados.length,

      locResultados,

      locTotalPerfeitos,

      locTotalComFallback,

      modelosResultados,

      modEspecificosOk,

      modUsaraoGenerico,

      eventosMapa: Array.from(eventosMapa.values()),

      eventosValidos,

      eventosInvalidos,

      matrizesStatus,

      totalMatrizesPresentes,

      todasMatrizesOk: totalMatrizesPresentes === matrizesObrigatorias.length,

      classifPlanilhaLista,

      classifPresentes,

      classifNovasACadastrar,

      todasClassifsUnidade

    };



    atualizarProgressoDiagnostico(

      100,

      'Concluído',

      `✅ Verificação concluída: ${modEspecificosOk} modelos, ${totalMatrizesPresentes}/7 matrizes e ${classifPresentes}/${classifPlanilhaLista.length} classificações prontas.`,

      false

    );



    if (btnDiag) {

      btnDiag.disabled = false;

      btnDiag.innerHTML = '<span>🔍</span> Verificação prévia';

    }

    if (btnIni) btnIni.disabled = false;



    addLog(`✅ Verificação prévia concluída! (${modEspecificosOk} modelos | ${totalMatrizesPresentes}/7 matrizes | ${classifPresentes}/${classifPlanilhaLista.length} classificações prontas).`);

    renderizarModalDiagnosticoCompleto(diagnosticoResultado);

    registrarLogDiagnostico(diagnosticoResultado);

  }



  function renderizarModalDiagnosticoCompleto(res) {

    const overlay = obterOuCriarModalOverlay();

    overlay.style.display = 'flex';

    overlay.style.alignItems = 'flex-start';

    overlay.style.justifyContent = 'center';

    overlay.style.paddingTop = '24px';

    overlay.style.overflowY = 'auto';



    overlay.innerHTML = `

      <div id="eproc-pref-modal-container" style="width: 1040px; max-width: 96vw; max-height: 92vh; display: flex; flex-direction: column; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.45); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin-top: 5px; margin-bottom: 25px;">

        <!-- HEADER -->

        <div class="eproc-pref-modal-header" style="background: linear-gradient(135deg, #005b8f 0%, #003e63 100%); padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0088cc;">

          <h3 style="margin: 0; font-size: 15px; font-weight: 700; color: #ffffff; display: flex; align-items: center; gap: 8px;">

            <span style="font-size: 18px;">🔍</span> Verificação prévia: Auditoria de Integridade eproc

            <span style="font-size: 11px; background: rgba(255,255,255,0.22); padding: 1px 6px; border-radius: 4px; font-weight: 600;">v3.5.6</span>

          </h3>

          <button type="button" class="eproc-pref-modal-close" id="btn-diag-fechar-topo" style="background: transparent; border: none; color: #ffffff; font-size: 20px; cursor: pointer; line-height: 1;">✕</button>

        </div>



        <!-- 4 CARDS DE INDICADORES (DASHBOARD) -->

        <div style="background: #ffffff; padding: 12px 18px; border-bottom: 1px solid #e2e8f0; display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px;">

          <!-- Card 1: Localizadores -->

          <div class="diag-stat-card" data-tab="tab-diag-locs" style="cursor: pointer; padding: 10px 12px; border-radius: 6px; border: 1.5px solid ${res.locTotalComFallback > 0 ? '#f59e0b' : '#10b981'}; background: ${res.locTotalComFallback > 0 ? '#fffbeb' : '#f0fdf4'};">

            <div style="font-size: 10.5px; font-weight: 700; color: #475569; text-transform: uppercase;">📍 1. Localizadores</div>

            <div style="font-size: 18px; font-weight: 800; color: ${res.locTotalComFallback > 0 ? '#b45309' : '#15803d'}; margin: 2px 0;">

              ${res.locTotalPerfeitos} / ${res.totalItens} OK

            </div>

            <div style="font-size: 11px; color: ${res.locTotalComFallback > 0 ? '#b45309' : '#15803d'};">

              ${res.locTotalComFallback > 0 ? `⚠️ ${res.locTotalComFallback} com Fallback (ARQUIVO/BAIXADOS)` : '✅ Todos existem na Vara'}

            </div>

          </div>



          <!-- Card 2: Modelos -->

          <div class="diag-stat-card" data-tab="tab-diag-modelos" style="cursor: pointer; padding: 10px 12px; border-radius: 6px; border: 1.5px solid #0284c7; background: #f0f9ff;">

            <div style="font-size: 10.5px; font-weight: 700; color: #475569; text-transform: uppercase;">📄 2. Modelos da Vara</div>

            <div style="font-size: 18px; font-weight: 800; color: #0369a1; margin: 2px 0;">

              ${res.modEspecificosOk} Específicos

            </div>

            <div style="font-size: 11px; color: #0369a1;">

              🛡️ ${res.modUsaraoGenerico} usarão Matriz Genérica

            </div>

          </div>



          <!-- Card 3: Eventos -->

          <div class="diag-stat-card" data-tab="tab-diag-eventos" style="cursor: pointer; padding: 10px 12px; border-radius: 6px; border: 1.5px solid ${res.eventosInvalidos > 0 ? '#ef4444' : '#10b981'}; background: ${res.eventosInvalidos > 0 ? '#fef2f2' : '#f0fdf4'};">

            <div style="font-size: 10.5px; font-weight: 700; color: #475569; text-transform: uppercase;">⚡ 3. Eventos eproc</div>

            <div style="font-size: 18px; font-weight: 800; color: ${res.eventosInvalidos > 0 ? '#b91c1c' : '#15803d'}; margin: 2px 0;">

              ${res.eventosValidos} / ${res.eventosMapa.length} Válidos

            </div>

            <div style="font-size: 11px; color: ${res.eventosInvalidos > 0 ? '#b91c1c' : '#15803d'};">

              ${res.eventosInvalidos > 0 ? `❌ ${res.eventosInvalidos} código(s) inválido(s)` : '✅ 100% dos códigos válidos'}

            </div>

          </div>



          <!-- Card 4: Matrizes Genéricas -->

          <div class="diag-stat-card" data-tab="tab-diag-matrizes" style="cursor: pointer; padding: 10px 12px; border-radius: 6px; border: 1.5px solid ${res.todasMatrizesOk ? '#10b981' : '#ef4444'}; background: ${res.todasMatrizesOk ? '#f0fdf4' : '#fef2f2'};">

            <div style="font-size: 10.5px; font-weight: 700; color: #475569; text-transform: uppercase;">🛡️ 4. Matrizes Genéricas</div>

            <div style="font-size: 18px; font-weight: 800; color: ${res.todasMatrizesOk ? '#15803d' : '#b91c1c'}; margin: 2px 0;">

              ${res.totalMatrizesPresentes} / ${res.matrizesStatus.length} Presentes

            </div>

            <div style="font-size: 11px; color: ${res.todasMatrizesOk ? '#15803d' : '#b91c1c'};">

              ${res.todasMatrizesOk ? '✅ Todas as matrizes prontas' : '⚠️ Matriz obrigatória ausente!'}

            </div>

          </div>



          <!-- Card 5: Classificações -->

          <div class="diag-stat-card" data-tab="tab-diag-classifs" style="cursor: pointer; padding: 10px 12px; border-radius: 6px; border: 1.5px solid #8b5cf6; background: #fbf7ff;">

            <div style="font-size: 10.5px; font-weight: 700; color: #475569; text-transform: uppercase;">🏷️ 5. Classificações</div>

            <div style="font-size: 18px; font-weight: 800; color: #6d28d9; margin: 2px 0;">

              ${res.classifPresentes} / ${res.classifPlanilhaLista.length} OK

            </div>

            <div style="font-size: 11px; color: #6d28d9;">

              ${res.classifNovasACadastrar > 0 ? `⚙️ ${res.classifNovasACadastrar} a cadastrar auto` : '✅ 100% já cadastradas'}

            </div>

          </div>

        </div>



        <!-- TABS DE NAVEGAÇÃO -->

        <div class="eproc-pref-modal-tabs" id="diag-tabs-nav" style="display: flex; background: #f1f5f9; border-bottom: 1px solid #cbd5e1; padding: 0 16px; gap: 4px;">

          <button type="button" class="eproc-pref-tab-btn active" data-target="tab-diag-locs">

            📍 Localizadores & Fallbacks (${res.locTotalComFallback > 0 ? `${res.locTotalComFallback} alertas` : '100% OK'})

          </button>

          <button type="button" class="eproc-pref-tab-btn" data-target="tab-diag-modelos">

            📄 Modelos da Unidade (${res.totalItens})

          </button>

          <button type="button" class="eproc-pref-tab-btn" data-target="tab-diag-eventos">

            ⚡ Eventos do Sistema (${res.eventosMapa.length} códigos)

          </button>

          <button type="button" class="eproc-pref-tab-btn" data-target="tab-diag-matrizes">

            🛡️ Matrizes Obrigatórias (${res.totalMatrizesPresentes}/${res.matrizesStatus.length})

          </button>

          <button type="button" class="eproc-pref-tab-btn" data-target="tab-diag-classifs">

            🏷️ Classificações (${res.classifPresentes} OK / ${res.classifNovasACadastrar} novas)

          </button>

        </div>



        <!-- CONTEÚDO DAS TABS -->

        <div class="eproc-pref-modal-body" style="padding: 14px 18px; overflow-y: auto; flex: 1; background: #f8fafc;">

          

          <!-- TAB 1: LOCALIZADORES -->

          <div class="diag-tab-pane" id="tab-diag-locs" style="display: block;">

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; background: #ffffff; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0;">

              <div style="font-size: 12px; color: #475569;">

                <b>Total:</b> ${res.totalItens} preferências | 

                <span style="color: #16a34a; font-weight: 700;">${res.locTotalPerfeitos} perfeitas</span> | 

                <span style="color: #b45309; font-weight: 700;">${res.locTotalComFallback} com localizador default (ARQUIVO / BAIXADOS)</span>

              </div>

              <label style="display: flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 600; color: #334155; cursor: pointer;">

                <input type="checkbox" id="chk-diag-somente-alertas" ${res.locTotalComFallback > 0 ? 'checked' : ''} />

                Mostrar apenas preferências com Fallback

              </label>

            </div>



            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; max-height: 380px; overflow-y: auto;">

              <table class="diag-table" style="width: 100%; border-collapse: collapse; font-size: 11.5px;">

                <thead>

                  <tr style="background: #f1f5f9; text-align: left; color: #334155;">

                    <th style="padding: 8px 10px; width: 45px;">Nº</th>

                    <th style="padding: 8px 10px; width: 35%;">Nome da Preferência</th>

                    <th style="padding: 8px 10px; width: 30%;">Localizador Principal</th>

                    <th style="padding: 8px 10px;">Localizadores Secundários</th>

                  </tr>

                </thead>

                <tbody id="tbody-diag-locs">

                  ${res.locResultados.map(item => `

                    <tr class="diag-row-loc ${item.precisaFallback ? 'diag-row-fallback' : 'diag-row-ok'}" style="border-bottom: 1px solid #e2e8f0; ${item.precisaFallback ? 'background: #fffdf5;' : ''}">

                      <td style="padding: 7px 10px; font-weight: 700; color: #64748b;">${item.num}</td>

                      <td style="padding: 7px 10px; font-weight: 600; color: #0f172a;">${item.nome}</td>

                      <td style="padding: 7px 10px;">

                        ${item.locPrincipal ? (item.principalOk ? `

                          <span style="color: #15803d; font-weight: 600;">✅ ${item.locPrincipal}</span>

                        ` : `

                          <span style="color: #b45309; font-weight: 700;">⚠️ ${item.locPrincipal}</span><br>

                          <small style="color: #64748b;">↳ Fallback Unidade: <b>ARQUIVO - ARQUIVO</b></small>

                        `) : '<span style="color: #94a3b8;">(Nenhum)</span>'}

                      </td>

                      <td style="padding: 7px 10px;">

                        ${item.locsSecundarios && item.locsSecundarios.length > 0 ? item.secStatus.map(s => s.ok ? `

                          <div style="color: #15803d; font-size: 11px;">✅ ${s.nome}</div>

                        ` : `

                          <div style="color: #b45309; font-size: 11px; font-weight: 700;">⚠️ ${s.nome}</div>

                          <small style="color: #64748b;">↳ Fallback Unidade: <b>BAIXADOS - BAIXADOS</b></small>

                        `).join('') : '<span style="color: #94a3b8;">(Nenhum)</span>'}

                      </td>

                    </tr>

                  `).join('')}

                </tbody>

              </table>

            </div>

          </div>



          <!-- TAB 2: MODELOS -->

          <div class="diag-tab-pane" id="tab-diag-modelos" style="display: none;">

            <div style="margin-bottom: 10px; background: #ffffff; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 12px; color: #475569;">

              <b>Resumo:</b> ${res.modEspecificosOk} modelos específicos encontrados na Unidade | 

              <b>${res.modUsaraoGenerico}</b> preferências utilizarão a matriz genérica correspondente.

            </div>



            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; max-height: 380px; overflow-y: auto;">

              <table class="diag-table" style="width: 100%; border-collapse: collapse; font-size: 11.5px;">

                <thead>

                  <tr style="background: #f1f5f9; text-align: left; color: #334155;">

                    <th style="padding: 8px 10px; width: 45px;">Nº</th>

                    <th style="padding: 8px 10px; width: 35%;">Nome da Preferência</th>

                    <th style="padding: 8px 10px; width: 30%;">Modelo Específico</th>

                    <th style="padding: 8px 10px;">Modelo Atribuído no eproc</th>

                  </tr>

                </thead>

                <tbody>

                  ${res.modelosResultados.map(m => `

                    <tr style="border-bottom: 1px solid #e2e8f0;">

                      <td style="padding: 7px 10px; font-weight: 700; color: #64748b;">${m.num}</td>

                      <td style="padding: 7px 10px; font-weight: 600;">${m.nome}</td>

                      <td style="padding: 7px 10px;">

                        ${m.modeloEspecifico ? (m.especificoExiste ? `

                          <span style="color: #15803d; font-weight: 600;">✅ ${m.modeloEspecifico}</span>

                        ` : `

                          <span style="color: #b45309; font-weight: 600;">⚠️ ${m.modeloEspecifico}</span><br>

                          <small style="color: #64748b;">↳ Ausente na Vara (usará matriz genérica)</small>

                        `) : '<span style="color: #94a3b8;">-</span>'}

                      </td>

                      <td style="padding: 7px 10px;">

                        <span style="color: #0369a1; font-weight: 600;">${m.descModeloFinal}</span>

                      </td>

                    </tr>

                  `).join('')}

                </tbody>

              </table>

            </div>

          </div>



          <!-- TAB 3: EVENTOS DO SISTEMA -->

          <div class="diag-tab-pane" id="tab-diag-eventos" style="display: none;">

            <div style="margin-bottom: 10px; background: #ffffff; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 12px; color: #475569;">

              <b>Total de Eventos Únicos Verificados:</b> ${res.eventosMapa.length} códigos de movimentação | 

              <span style="color: #16a34a; font-weight: 700;">${res.eventosValidos} ativos e válidos</span>

              ${res.eventosInvalidos > 0 ? ` | <span style="color: #dc2626; font-weight: 700;">${res.eventosInvalidos} divergentes</span>` : ''}

            </div>



            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; max-height: 380px; overflow-y: auto;">

              <table class="diag-table" style="width: 100%; border-collapse: collapse; font-size: 11.5px;">

                <thead>

                  <tr style="background: #f1f5f9; text-align: left; color: #334155;">

                    <th style="padding: 8px 10px; width: 75px;">Código</th>

                    <th style="padding: 8px 10px; width: 35%;">Descrição na Planilha</th>

                    <th style="padding: 8px 10px; width: 35%;">Validação no eproc</th>

                    <th style="padding: 8px 10px; width: 75px;">Status</th>

                    <th style="padding: 8px 10px;">Itens</th>

                  </tr>

                </thead>

                <tbody>

                  ${res.eventosMapa.map(ev => `

                    <tr style="border-bottom: 1px solid #e2e8f0;">

                      <td style="padding: 7px 10px; font-weight: 800; color: #0284c7;">${ev.cod || '-'}</td>

                      <td style="padding: 7px 10px; font-weight: 600;">${ev.nomePlanilha}</td>

                      <td style="padding: 7px 10px; color: #334155;">${ev.eprocDescricao || ev.nomePlanilha}</td>

                      <td style="padding: 7px 10px;">

                        ${ev.valido ? `

                          <span style="background: #dcfce7; color: #15803d; font-weight: 700; padding: 2px 7px; border-radius: 10px; font-size: 10.5px;">✅ Válido</span>

                        ` : `

                          <span style="background: #fee2e2; color: #b91c1c; font-weight: 700; padding: 2px 7px; border-radius: 10px; font-size: 10.5px;">❌ Inválido</span>

                        `}

                      </td>

                      <td style="padding: 7px 10px; font-size: 11px; color: #64748b;">

                        ${ev.linhas.length} linha(s)

                      </td>

                    </tr>

                  `).join('')}

                </tbody>

              </table>

            </div>

          </div>



          <!-- TAB 4: MATRIZES OBRIGATÓRIAS -->

          <div class="diag-tab-pane" id="tab-diag-matrizes" style="display: none;">

            <div style="margin-bottom: 12px; background: ${res.todasMatrizesOk ? '#f0fdf4' : '#fffbeb'}; border: 1.5px solid ${res.todasMatrizesOk ? '#10b981' : '#f59e0b'}; padding: 12px 16px; border-radius: 6px;">

              <div style="font-weight: 800; font-size: 13px; color: ${res.todasMatrizesOk ? '#15803d' : '#b45309'}; margin-bottom: 2px;">

                ${res.todasMatrizesOk ? '✅ Todas as matrizes genéricas obrigatórias estão cadastradas!' : '⚠️ Atenção: Matrizes Genéricas Ausentes'}

              </div>

              <div style="font-size: 11.5px; color: #475569;">

                O eproc exige a existência prévia dessas matrizes na Unidade para que minutas de Despacho, Sentença, Ato, Mandado e Carta AR possam ser geradas em lote.

              </div>

            </div>



            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">

              ${res.matrizesStatus.map(m => `

                <div style="background: #ffffff; border: 1.5px solid ${m.presente ? '#e2e8f0' : '#ef4444'}; border-radius: 6px; padding: 12px; display: flex; align-items: center; justify-content: space-between;">

                  <div>

                    <div style="font-weight: 800; font-size: 12.5px; color: #0f172a;">${m.label}</div>

                    <div style="font-size: 11px; color: #64748b; margin-top: 3px;">

                      ${m.presente ? `Cadastrada no eproc: <b style="color: #0369a1;">"${m.encontrado}"</b>` : '<span style="color: #b91c1c; font-weight: 700;">⚠️ Não cadastrada nesta Unidade</span>'}

                    </div>

                  </div>

                  <div>

                    ${m.presente ? `

                      <span style="background: #dcfce7; color: #15803d; font-weight: 800; padding: 4px 10px; border-radius: 12px; font-size: 11px;">✅ Presente</span>

                    ` : `

                      <span style="background: #fee2e2; color: #b91c1c; font-weight: 800; padding: 4px 10px; border-radius: 12px; font-size: 11px;">❌ Ausente</span>

                    `}

                  </div>

                </div>

              `).join('')}

            </div>

          </div>



          <!-- TAB 5: CLASSIFICAÇÕES -->

          <div class="diag-tab-pane" id="tab-diag-classifs" style="display: none;">

            <div style="margin-bottom: 12px; background: #fbf7ff; border: 1.5px solid #c4b5fd; padding: 12px 16px; border-radius: 6px;">

              <div style="font-weight: 800; font-size: 13px; color: #6d28d9; margin-bottom: 3px;">

                🏷️ Auditoria de Classificações de Minuta (Unidade: ${res.todasClassifsUnidade.length} cadastradas | Planilha: ${res.classifPlanilhaLista.length} tipos exigidos)

              </div>

              <div style="font-size: 11.5px; color: #475569;">

                As classificações já cadastradas na Unidade serão associadas com segurança pelo respectivo ID numérico.

                ${res.classifNovasACadastrar > 0 ? `<b style="color: #6d28d9;">${res.classifNovasACadastrar} classificação(ões) faltante(s)</b> serão <b>cadastradas automaticamente no eproc</b> durante o lote.` : 'Todas as classificações da planilha já existem e estão prontas no eproc.'}

              </div>

            </div>



            <!-- TABELA DE CLASSIFICAÇÕES DA PLANILHA -->

            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; max-height: 280px; overflow-y: auto; margin-bottom: 14px;">

              <table class="diag-table" style="width: 100%; border-collapse: collapse; font-size: 11.5px;">

                <thead>

                  <tr style="background: #f1f5f9; text-align: left; color: #334155;">

                    <th style="padding: 8px 10px; width: 40px;">#</th>

                    <th style="padding: 8px 10px; width: 35%;">Classificação na Planilha</th>

                    <th style="padding: 8px 10px; width: 25%;">Uso nas Preferências</th>

                    <th style="padding: 8px 10px; width: 20%;">ID no eproc</th>

                    <th style="padding: 8px 10px;">Status de Prontidão</th>

                  </tr>

                </thead>

                <tbody>

                  ${res.classifPlanilhaLista.map((c, idx) => `

                    <tr style="border-bottom: 1px solid #e2e8f0; ${!c.presenteNaUnidade ? 'background: #faf5ff;' : ''}">

                      <td style="padding: 7px 10px; font-weight: 700; color: #64748b;">${idx + 1}</td>

                      <td style="padding: 7px 10px; font-weight: 700; color: #0f172a;">

                        🏷️ ${c.nomeOriginal}

                      </td>

                      <td style="padding: 7px 10px; color: #475569;">

                        <b>${c.itensCount}</b> preferência(s) <small style="color: #64748b;">(linhas: ${c.linhas.slice(0, 4).join(', ')}${c.linhas.length > 4 ? '...' : ''})</small>

                      </td>

                      <td style="padding: 7px 10px; font-family: monospace; font-size: 11px;">

                        ${c.presenteNaUnidade ? `<b style="color: #0369a1;">${c.idNaUnidade}</b>` : '<span style="color: #94a3b8; font-style: italic;">(Novo ID ao criar)</span>'}

                      </td>

                      <td style="padding: 7px 10px;">

                        ${c.presenteNaUnidade ? `

                          <span style="background: #dcfce7; color: #15803d; font-weight: 800; padding: 3px 8px; border-radius: 12px; font-size: 10.5px;">

                            ✅ Presente na Unidade

                          </span>

                        ` : `

                          <span style="background: #ede9fe; color: #6d28d9; font-weight: 800; padding: 3px 8px; border-radius: 12px; font-size: 10.5px;">

                            ⚙️ A cadastrar no eproc

                          </span>

                        `}

                      </td>

                    </tr>

                  `).join('')}

                </tbody>

              </table>

            </div>



            <!-- GRADE DAS CLASSIFICAÇÕES EXISTENTES NA UNIDADE -->

            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px;">

              <div style="font-weight: 700; font-size: 12px; color: #334155; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">

                <span>📚 Classificações atualmente cadastradas nesta Vara (${res.todasClassifsUnidade.length} no eproc):</span>

                <span style="font-size: 11px; font-weight: 400; color: #64748b;">Lidas via janela/tabela oficial</span>

              </div>

              <div style="display: flex; flex-wrap: wrap; gap: 6px;">

                ${res.todasClassifsUnidade.map(u => `

                  <span style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 3px 8px; border-radius: 4px; font-size: 11px; color: #1e293b;">

                    🏷️ <b>${u.text}</b> <small style="color: #64748b; font-family: monospace;">(${u.id})</small>

                  </span>

                `).join('')}

              </div>

            </div>

          </div>



        </div>



        <!-- FOOTER COM AÇÕES -->

        <div class="eproc-pref-modal-footer" style="padding: 12px 18px; background: #ffffff; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">

          <div style="font-size: 11.5px; color: #64748b;">

            Verificação concluída às <b>${res.timestamp}</b> • <b>${res.totalItens}</b> preferências verificadas

          </div>

          <div style="display: flex; gap: 8px;">

            <button type="button" class="rito-btn rito-btn-secondary" id="btn-diag-copiar" style="width: auto; padding: 6px 14px; font-size: 12px; margin-top: 0;">

              <span>📋</span> Copiar Relatório

            </button>

            <button type="button" class="rito-btn rito-btn-secondary" id="btn-diag-fechar-baixo" style="width: auto; padding: 6px 14px; font-size: 12px; margin-top: 0;">

              Fechar

            </button>

            <button type="button" class="rito-btn rito-btn-primary" id="btn-diag-prosseguir" style="width: auto; padding: 6px 18px; font-size: 12.5px; font-weight: 700; background: #16a34a; border-color: #15803d; margin-top: 0;">

              <span>🚀</span> Prosseguir para Criação em Lote

            </button>

          </div>

        </div>

      </div>

    `;



    // Interatividade das Tabs

    const tabsContainer = overlay.querySelector('#diag-tabs-nav');

    const tabBtns = overlay.querySelectorAll('.eproc-pref-tab-btn, .diag-stat-card');

    const panes = overlay.querySelectorAll('.diag-tab-pane');



    tabBtns.forEach(btn => {

      btn.addEventListener('click', () => {

        const targetId = btn.getAttribute('data-target') || btn.getAttribute('data-tab');

        if (!targetId) return;



        overlay.querySelectorAll('.eproc-pref-tab-btn').forEach(b => {

          b.classList.toggle('active', b.getAttribute('data-target') === targetId);

        });



        panes.forEach(p => {

          p.style.display = (p.id === targetId ? 'block' : 'none');

        });

      });

    });



    // Filtro da Tab 1: Somente Alertas com Fallback

    const chkSomenteAlertas = overlay.querySelector('#chk-diag-somente-alertas');

    if (chkSomenteAlertas) {

      const filtrarTabelaLocs = () => {

        const apenasAlertas = chkSomenteAlertas.checked;

        overlay.querySelectorAll('#tbody-diag-locs tr').forEach(tr => {

          if (apenasAlertas) {

            tr.style.display = tr.classList.contains('diag-row-fallback') ? '' : 'none';

          } else {

            tr.style.display = '';

          }

        });

      };

      chkSomenteAlertas.addEventListener('change', filtrarTabelaLocs);

      filtrarTabelaLocs();

    }



    // Fechar Modal

    const fechar = () => { overlay.style.display = 'none'; };

    const btnCloseTop = overlay.querySelector('#btn-diag-fechar-topo');

    const btnCloseBottom = overlay.querySelector('#btn-diag-fechar-baixo');

    if (btnCloseTop) btnCloseTop.onclick = fechar;

    if (btnCloseBottom) btnCloseBottom.onclick = fechar;



    // Copiar Relatório

    const btnCopiar = overlay.querySelector('#btn-diag-copiar');

    if (btnCopiar) {

      btnCopiar.onclick = () => {

        const txt = gerarTextoRelatorio(res);

        if (navigator.clipboard && navigator.clipboard.writeText) {

          navigator.clipboard.writeText(txt).then(() => {

            btnCopiar.innerHTML = '<span>✅</span> Copiado!';

            setTimeout(() => { btnCopiar.innerHTML = '<span>📋</span> Copiar Relatório'; }, 2000);

          }).catch(() => {

            alertOriginal.call(window, 'Não foi possível copiar automaticamente para a área de transferência.');

          });

        }

      };

    }



    // Prosseguir para Criação em Lote

    const btnProsseguir = overlay.querySelector('#btn-diag-prosseguir');

    if (btnProsseguir) {

      btnProsseguir.onclick = () => {

        fechar();

        iniciarExecucao();

      };

    }

  }



  function gerarTextoRelatorio(res) {

    const fallbacks = res.locResultados.filter(i => i.precisaFallback);

    return `===============================================================

RELATÓRIO DE AUDITORIA PRÉ-VOO (VERIFICAÇÃO PRÉVIA EPROC TJSP)

Versão: 7.8

Data/Hora: ${res.dataCompleta}

Total de Preferências Auditadas: ${res.totalItens}

===============================================================



1. VARREDURA DE LOCALIZADORES (UNIDADE x PLANILHA)

- Perfeitas (encontradas na Vara): ${res.locTotalPerfeitos}

- Com Fallback aplicado: ${res.locTotalComFallback}

${fallbacks.length > 0 ? fallbacks.map(f => {

  let linhaTxt = `  • Linha ${f.linha} (Nº ${f.num}): "${f.nome}"\n`;

  if (!f.principalOk && f.locPrincipal) {

    linhaTxt += `    ↳ Principal Ausente: "${f.locPrincipal}" -> Fallback para "ARQUIVO - ARQUIVO"\n`;

  }

  const secAusentes = f.secStatus.filter(s => !s.ok).map(s => s.nome);

  if (secAusentes.length > 0) {

    linhaTxt += `    ↳ Secundário(s) Ausente(s): "${secAusentes.join(', ')}" -> Fallback para "BAIXADOS - BAIXADOS"\n`;

  }

  return linhaTxt;

}).join('') : '  ✅ Todos os localizadores da planilha foram encontrados nesta Unidade.\n'}



2. VARREDURA DE MODELOS DA UNIDADE

- Modelos específicos encontrados na Unidade: ${res.modEspecificosOk}

- Preferências com recurso à Matriz Genérica: ${res.modUsaraoGenerico}



3. VARREDURA DE EVENTOS DO SISTEMA EPROC

- Códigos únicos de evento verificados: ${res.eventosMapa.length}

- Códigos válidos/reconhecidos: ${res.eventosValidos}

- Códigos inválidos ou com divergência: ${res.eventosInvalidos}



4. MATRIZES GENÉRICAS OBRIGATÓRIAS

${res.matrizesStatus.map(m => `  • ${m.label}: ${m.presente ? `✅ Presente (${m.encontrado})` : '❌ AUSENTE NA UNIDADE'}`).join('\n')}



5. VARREDURA DE CLASSIFICAÇÕES DE MINUTAS (UNIDADE x PLANILHA)

- Cadastradas na Unidade: ${res.todasClassifsUnidade.length}

- Tipos de classificação exigidos pela Planilha: ${res.classifPlanilhaLista.length}

- Já presentes na Unidade: ${res.classifPresentes}

- A cadastrar automaticamente pelo script: ${res.classifNovasACadastrar}

${res.classifPlanilhaLista.map(c => `  • "${c.nomeOriginal}": ${c.presenteNaUnidade ? `✅ Presente na Unidade (ID: ${c.idNaUnidade}) - em ${c.itensCount} pref.` : `⚙️ A cadastrar no eproc - em ${c.itensCount} pref.`}`).join('\n')}



STATUS GERAL DO DIAGNÓSTICO:

${res.eventosInvalidos === 0 && res.todasMatrizesOk ? '✅ PRONTO PARA CRIAÇÃO EM LOTE COM 100% DE SEGURANÇA.' : '⚠️ ATENÇÃO: Verifique os alertas acima antes de iniciar o lote.'}

===============================================================`;

  }



  function registrarLogDiagnostico(res) {

    const box = document.getElementById('rito-logs');

    if (!box) return;

    if (box.textContent.trim() === 'Aguardando planilha...') box.innerHTML = '';



    const card = document.createElement('div');

    card.className = 'rito-log-card';

    card.style.borderColor = res.locTotalComFallback > 0 ? '#f59e0b' : '#10b981';



    card.innerHTML = `

      <div class="rito-log-card-header" style="background:${res.locTotalComFallback > 0 ? '#d97706' : '#16a34a'};">

        <span>🔍 VERIFICAÇÃO PRÉVIA CONCLUÍDA</span>

        <span>${res.timestamp}</span>

      </div>

      <div class="rito-log-card-body" style="font-size: 11px;">

        <div><b>• Total analisado:</b> ${res.totalItens} preferências</div>

        <div><b>• Localizadores:</b> ${res.locTotalPerfeitos} perfeitos / <span style="color:#fbbf24; font-weight:bold;">${res.locTotalComFallback} com fallback</span></div>

        <div><b>• Modelos:</b> ${res.modEspecificosOk} específicos / ${res.modUsaraoGenerico} usarão genérico</div>

        <div><b>• Eventos eproc:</b> ${res.eventosValidos} de ${res.eventosMapa.length} códigos verificados</div>

        <div><b>• Matrizes Genéricas:</b> ${res.totalMatrizesPresentes} de ${res.matrizesStatus.length} presentes</div>

        <div><b>• Classificações:</b> ${res.classifPresentes} na Unidade / <span style="color:#a78bfa; font-weight:bold;">${res.classifNovasACadastrar} a cadastrar auto</span></div>

        <div style="margin-top:6px;">

          <button type="button" class="rito-btn rito-btn-secondary" id="btn-reabrir-diag-log" style="width:100%; font-size:11px; padding:4px 6px;">

            🔍 Reabrir Relatório da Verificação prévia

          </button>

        </div>

      </div>

    `;



    box.appendChild(card);

    /* rolagem automática do log desativada */

    salvarLogsNoStorage();



    const btnReabrir = card.querySelector('#btn-reabrir-diag-log');

    if (btnReabrir) {

      btnReabrir.onclick = () => renderizarModalDiagnosticoCompleto(res);

    }

  }





    /* ================== INICIALIZAÇÃO ================== */

  function iniciar() {

    criarPainel();

  }



  if (document.readyState === 'loading') {

    document.addEventListener('DOMContentLoaded', iniciar);

  } else {

    iniciar();

  }



  let t = 0;

  const poll = setInterval(() => {

    t++;

    if (!document.getElementById('rito-panel')) criarPainel();

    if (t > 15) clearInterval(poll);

  }, 400);



})();

