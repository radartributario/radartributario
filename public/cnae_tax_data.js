window.CNAE_TAX_DATA = {};

// Classifica automaticamente todo CNAE segundo as regras tributárias
window.autoClassifyCnae = function(cnae, fatorR) {
  const cod = cnae.codigo || '';
  const classe = cod.split('/')[0];
  const desc = (cnae.descricao || '').toLowerCase();
  const numClasse = parseInt(classe.replace(/\D/g,'')) || 0;

  if (window.CNAE_ANEXO_IV && window.CNAE_ANEXO_IV.has(classe)) {
    return { anexo_simples: 'Anexo IV', categoria_tributaria: 'construcao' };
  }
  if (classe && (classe.startsWith('7719')||classe.startsWith('7711')||classe.startsWith('772'))) {
    return { anexo_simples: 'Anexo III', categoria_tributaria: 'servico' };
  }
  if (window.CNAE_FATOR_R && window.CNAE_FATOR_R.has(classe)) {
    const anexo = (fatorR || 0) >= 0.28 ? 'Anexo III' : 'Anexo V';
    return { anexo_simples: anexo, categoria_tributaria: 'servico' };
  }
  if (numClasse >= 10 && numClasse <= 33) {
    return { anexo_simples: 'Anexo II', categoria_tributaria: 'industria' };
  }
  if (numClasse >= 45 && numClasse <= 49) {
    return { anexo_simples: 'Anexo I', categoria_tributaria: 'comercio' };
  }
  if (numClasse >= 55 && numClasse <= 56) {
    return { anexo_simples: 'Anexo III', categoria_tributaria: 'servico' };
  }
  if (numClasse >= 61 && numClasse <= 63) {
    return { anexo_simples: 'Anexo III', categoria_tributaria: 'servico' };
  }
  if ((numClasse >= 64 && numClasse <= 66) || (numClasse >= 68 && numClasse <= 82)) {
    return { anexo_simples: 'Anexo V', categoria_tributaria: 'servico' };
  }
  if (numClasse >= 85 && numClasse <= 88) {
    return { anexo_simples: 'Anexo III', categoria_tributaria: 'servico' };
  }
  if (numClasse >= 86 && numClasse <= 87) {
    return { anexo_simples: 'Anexo III', categoria_tributaria: 'servico' };
  }
  if (numClasse >= 90 && numClasse <= 93) {
    return { anexo_simples: 'Anexo III', categoria_tributaria: 'servico' };
  }
  if (numClasse >= 94 && numClasse <= 96) {
    return { anexo_simples: 'Anexo III', categoria_tributaria: 'servico' };
  }

  // Fallback por descrição
  if (desc.includes('comércio') || desc.includes('comercio') || desc.includes('loja')) {
    return { anexo_simples: 'Anexo I', categoria_tributaria: 'comercio' };
  }
  if (desc.includes('indústria') || desc.includes('industria') || desc.includes('fabrica') || desc.includes('fabricação') || desc.includes('fabricacao')) {
    return { anexo_simples: 'Anexo II', categoria_tributaria: 'industria' };
  }
  if (desc.includes('construção') || desc.includes('construcao') || desc.includes('obra')) {
    return { anexo_simples: 'Anexo IV', categoria_tributaria: 'construcao' };
  }

  return { anexo_simples: 'Anexo III', categoria_tributaria: 'servico' };
};

// CBS Reforma: classifica tratamento por CNAE
window.getCbsTreatment = function(codigo) {
  const classe = (codigo || '').split('/')[0];
  const num = parseInt(classe.replace(/\D/g,'')) || 0;

  // Alíquota zero (cesta básica, exportações, etc)
  if (num >= 111 && num <= 119) return { tipo: 'zero', desc: 'Alíquota Zero (Cesta Básica)' };
  if (num >= 11 && num <= 15) return { tipo: 'zero', desc: 'Alíquota Zero - Agropecuária' };

  // Alíquota reduzida (60% da padrão = ~5,28%) - setores com redução na CBS (LC 214/2025, arts. 8º e 9º)
  if (num >= 85 && num <= 88) return { tipo: 'reduzida', fator: 0.6, desc: 'Alíq. Reduzida 60% - Educação e Saúde' };
  if (num >= 49 && num <= 52) return { tipo: 'reduzida', fator: 0.6, desc: 'Alíq. Reduzida 60% - Transporte' };
  if ((classe.startsWith('86')||classe.startsWith('87')||classe.startsWith('8610')||classe.startsWith('8621')||classe.startsWith('8622')||classe.startsWith('8630')||classe.startsWith('8640')||classe.startsWith('8650')||classe.startsWith('8660')||classe.startsWith('8690'))) return { tipo: 'reduzida', fator: 0.6, desc: 'Alíq. Reduzida 60% - Serviços de Saúde' };
  if (num >= 58 && num <= 60) return { tipo: 'reduzida', fator: 0.6, desc: 'Alíq. Reduzida 60% - Comunicação' };
  if (num >= 64 && num <= 66) return { tipo: 'reduzida', fator: 0.6, desc: 'Alíq. Reduzida 60% - Financeiro' };
  // Serviços profissionais, científicos e técnicos (LC 214/2025, art. 9º)
  if (num >= 69 && num <= 75) return { tipo: 'reduzida', fator: 0.6, desc: 'Alíq. Reduzida 60% - Serviços Profissionais' };
  // Serviços administrativos e suporte (LC 214/2025, art. 9º)
  if (num >= 77 && num <= 82) return { tipo: 'reduzida', fator: 0.6, desc: 'Alíq. Reduzida 60% - Serviços Administrativos' };
  // Artes, cultura, esporte (LC 214/2025, art. 9º)
  if (num >= 90 && num <= 93) return { tipo: 'reduzida', fator: 0.6, desc: 'Alíq. Reduzida 60% - Artes e Cultura' };

  // Alíquota padrão
  return { tipo: 'padrao', desc: 'Alíq. Padrão (8,8%)' };
};

// Popula CNAE_TAX_DATA com classificação automática
window.populateAutoTaxData = function() {
  if (!window.CNAE_DATA) return;
  for (const item of window.CNAE_DATA) {
    const cls = window.autoClassifyCnae(item, 0);
    const cbs = window.getCbsTreatment(item.codigo);
    window.CNAE_TAX_DATA[item.codigo] = {
      codigo: item.codigo,
      categoria_tributaria: cls.categoria_tributaria,
      anexo_simples: cls.anexo_simples,
      cbs_tipo: cbs.tipo,
      cbs_desc: cbs.desc,
      cbs_fator: cbs.fator || 1,
      status: 'validado',
      validado_por: 'sistema'
    };
  }
};
