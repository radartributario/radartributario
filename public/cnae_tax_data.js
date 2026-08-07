window.CNAE_TAX_DATA = {};

// Classifica automaticamente todo CNAE segundo as regras tributárias
window.autoClassifyCnae = function(cnae, fatorR) {
  const cod = cnae.codigo || '';
  const classe = cod.split('/')[0];
  const desc = (cnae.descricao || '').toLowerCase();
  const digits = classe.replace(/\D/g,'');
  const div = parseInt(digits.substring(0,2)) || 0;

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
  if (div >= 10 && div <= 33) {
    return { anexo_simples: 'Anexo II', categoria_tributaria: 'industria' };
  }
  if (div >= 45 && div <= 47) {
    return { anexo_simples: 'Anexo I', categoria_tributaria: 'comercio' };
  }
  if (div >= 55 && div <= 56) {
    return { anexo_simples: 'Anexo III', categoria_tributaria: 'servico' };
  }
  if (div >= 61 && div <= 63) {
    return { anexo_simples: 'Anexo III', categoria_tributaria: 'servico' };
  }
  if ((div >= 64 && div <= 66) || (div >= 68 && div <= 82)) {
    return { anexo_simples: 'Anexo V', categoria_tributaria: 'servico' };
  }
  if (div >= 85 && div <= 88) {
    return { anexo_simples: 'Anexo III', categoria_tributaria: 'servico' };
  }
  if (div >= 86 && div <= 87) {
    return { anexo_simples: 'Anexo III', categoria_tributaria: 'servico' };
  }
  if (div >= 90 && div <= 93) {
    return { anexo_simples: 'Anexo III', categoria_tributaria: 'servico' };
  }
  if (div >= 94 && div <= 96) {
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
  const digits = classe.replace(/\D/g,'');
  if (!digits) return { tipo: 'padrao', desc: 'Alíq. Padrão (9,21%)' };

  // Extrai a divisão CNAE (2 primeiros dígitos) para classificação por setor
  const div = parseInt(digits.substring(0,2), 10);

  // Alíquota zero (cesta básica, exportações, etc)
  if (digits.startsWith('011') || digits.startsWith('111')) return { tipo: 'zero', desc: 'Alíquota Zero (Cesta Básica)' };
  if (div >= 1 && div <= 3) return { tipo: 'zero', desc: 'Alíquota Zero - Agropecuária' };

  // Alíquota reduzida (60% da padrão = ~5,28%) - setores com redução na CBS (LC 214/2025 c/c LC 227/2026)
  if (div >= 85 && div <= 88) return { tipo: 'reduzida', fator: 0.6, desc: 'Alíq. Reduzida 60% - Educação e Saúde', lei: 'Art. 128, I-II' };
  if (div >= 58 && div <= 60) return { tipo: 'reduzida', fator: 0.6, desc: 'Alíq. Reduzida 60% - Comunicação e Cultura', lei: 'Art. 128, X' };
  if (div === 80) return { tipo: 'reduzida', fator: 0.6, desc: 'Alíq. Reduzida 60% - Segurança', lei: 'Art. 128, XIII' };
  if (div >= 90 && div <= 93) return { tipo: 'reduzida', fator: 0.6, desc: 'Alíq. Reduzida 60% - Artes, Cultura e Esporte', lei: 'Art. 128, X e XII' };

  // Alíquota reduzida (30% da padrão = ~6,16%) - profissionais liberais (LC 214/2025, Art. 127)
  if (div >= 69 && div <= 75) return { tipo: 'reduzida', fator: 0.7, desc: 'Alíq. Reduzida 30% - Profissionais Liberais', lei: 'Art. 127' };

  // Alíquota padrão
  return { tipo: 'padrao', desc: 'Alíq. Padrão (9,21%)', lei: 'Arts. 14-16' };
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
