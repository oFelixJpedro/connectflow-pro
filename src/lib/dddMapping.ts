// Mapping of Brazilian DDD (area codes) to states
export const DDD_TO_STATE: Record<string, { state: string; name: string }> = {
  // São Paulo
  '11': { state: 'SP', name: 'São Paulo' },
  '12': { state: 'SP', name: 'São Paulo' },
  '13': { state: 'SP', name: 'São Paulo' },
  '14': { state: 'SP', name: 'São Paulo' },
  '15': { state: 'SP', name: 'São Paulo' },
  '16': { state: 'SP', name: 'São Paulo' },
  '17': { state: 'SP', name: 'São Paulo' },
  '18': { state: 'SP', name: 'São Paulo' },
  '19': { state: 'SP', name: 'São Paulo' },
  
  // Rio de Janeiro
  '21': { state: 'RJ', name: 'Rio de Janeiro' },
  '22': { state: 'RJ', name: 'Rio de Janeiro' },
  '24': { state: 'RJ', name: 'Rio de Janeiro' },
  
  // Espírito Santo
  '27': { state: 'ES', name: 'Espírito Santo' },
  '28': { state: 'ES', name: 'Espírito Santo' },
  
  // Minas Gerais
  '31': { state: 'MG', name: 'Minas Gerais' },
  '32': { state: 'MG', name: 'Minas Gerais' },
  '33': { state: 'MG', name: 'Minas Gerais' },
  '34': { state: 'MG', name: 'Minas Gerais' },
  '35': { state: 'MG', name: 'Minas Gerais' },
  '37': { state: 'MG', name: 'Minas Gerais' },
  '38': { state: 'MG', name: 'Minas Gerais' },
  
  // Paraná
  '41': { state: 'PR', name: 'Paraná' },
  '42': { state: 'PR', name: 'Paraná' },
  '43': { state: 'PR', name: 'Paraná' },
  '44': { state: 'PR', name: 'Paraná' },
  '45': { state: 'PR', name: 'Paraná' },
  '46': { state: 'PR', name: 'Paraná' },
  
  // Santa Catarina
  '47': { state: 'SC', name: 'Santa Catarina' },
  '48': { state: 'SC', name: 'Santa Catarina' },
  '49': { state: 'SC', name: 'Santa Catarina' },
  
  // Rio Grande do Sul
  '51': { state: 'RS', name: 'Rio Grande do Sul' },
  '53': { state: 'RS', name: 'Rio Grande do Sul' },
  '54': { state: 'RS', name: 'Rio Grande do Sul' },
  '55': { state: 'RS', name: 'Rio Grande do Sul' },
  
  // Distrito Federal
  '61': { state: 'DF', name: 'Distrito Federal' },
  
  // Goiás
  '62': { state: 'GO', name: 'Goiás' },
  '64': { state: 'GO', name: 'Goiás' },
  
  // Tocantins
  '63': { state: 'TO', name: 'Tocantins' },
  
  // Mato Grosso
  '65': { state: 'MT', name: 'Mato Grosso' },
  '66': { state: 'MT', name: 'Mato Grosso' },
  
  // Mato Grosso do Sul
  '67': { state: 'MS', name: 'Mato Grosso do Sul' },
  
  // Acre
  '68': { state: 'AC', name: 'Acre' },
  
  // Rondônia
  '69': { state: 'RO', name: 'Rondônia' },
  
  // Bahia
  '71': { state: 'BA', name: 'Bahia' },
  '73': { state: 'BA', name: 'Bahia' },
  '74': { state: 'BA', name: 'Bahia' },
  '75': { state: 'BA', name: 'Bahia' },
  '77': { state: 'BA', name: 'Bahia' },
  
  // Sergipe
  '79': { state: 'SE', name: 'Sergipe' },
  
  // Pernambuco
  '81': { state: 'PE', name: 'Pernambuco' },
  '87': { state: 'PE', name: 'Pernambuco' },
  
  // Alagoas
  '82': { state: 'AL', name: 'Alagoas' },
  
  // Paraíba
  '83': { state: 'PB', name: 'Paraíba' },
  
  // Rio Grande do Norte
  '84': { state: 'RN', name: 'Rio Grande do Norte' },
  
  // Ceará
  '85': { state: 'CE', name: 'Ceará' },
  '88': { state: 'CE', name: 'Ceará' },
  
  // Piauí
  '86': { state: 'PI', name: 'Piauí' },
  '89': { state: 'PI', name: 'Piauí' },
  
  // Maranhão
  '98': { state: 'MA', name: 'Maranhão' },
  '99': { state: 'MA', name: 'Maranhão' },
  
  // Pará
  '91': { state: 'PA', name: 'Pará' },
  '93': { state: 'PA', name: 'Pará' },
  '94': { state: 'PA', name: 'Pará' },
  
  // Amapá
  '96': { state: 'AP', name: 'Amapá' },
  
  // Amazonas
  '92': { state: 'AM', name: 'Amazonas' },
  '97': { state: 'AM', name: 'Amazonas' },
  
  // Roraima
  '95': { state: 'RR', name: 'Roraima' },
};

// Get state info from phone number
export function getStateFromPhone(phone: string): { state: string; name: string } | null {
  const digits = phone.replace(/\D/g, '');
  
  // Format: +55 (DDD) XXXXX-XXXX = 13 digits for mobile, 12 for landline
  // Or just the number without country code
  let ddd: string | null = null;
  
  if (digits.length >= 12 && digits.startsWith('55')) {
    ddd = digits.slice(2, 4);
  } else if (digits.length >= 10 && !digits.startsWith('55')) {
    ddd = digits.slice(0, 2);
  }
  
  if (ddd && DDD_TO_STATE[ddd]) {
    return DDD_TO_STATE[ddd];
  }
  
  return null;
}

// State codes for SVG map highlighting
export const STATE_CODES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
] as const;

export type StateCode = typeof STATE_CODES[number];

// Get state name from code
export function getStateName(code: StateCode): string {
  const stateNames: Record<StateCode, string> = {
    AC: 'Acre',
    AL: 'Alagoas',
    AP: 'Amapá',
    AM: 'Amazonas',
    BA: 'Bahia',
    CE: 'Ceará',
    DF: 'Distrito Federal',
    ES: 'Espírito Santo',
    GO: 'Goiás',
    MA: 'Maranhão',
    MT: 'Mato Grosso',
    MS: 'Mato Grosso do Sul',
    MG: 'Minas Gerais',
    PA: 'Pará',
    PB: 'Paraíba',
    PR: 'Paraná',
    PE: 'Pernambuco',
    PI: 'Piauí',
    RJ: 'Rio de Janeiro',
    RN: 'Rio Grande do Norte',
    RS: 'Rio Grande do Sul',
    RO: 'Rondônia',
    RR: 'Roraima',
    SC: 'Santa Catarina',
    SP: 'São Paulo',
    SE: 'Sergipe',
    TO: 'Tocantins',
  };
  return stateNames[code];
}
