export const parseModifiers = (modifiersField: any): any[] => {
  if (Array.isArray(modifiersField)) return modifiersField;
  if (typeof modifiersField === 'string' && modifiersField.trim()) {
    try {
      const parsed = JSON.parse(modifiersField);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      if (modifiersField.includes(',')) {
        return modifiersField.split(',').map((m: string) => ({ name: m.trim() }));
      }
      return [{ name: modifiersField.trim() }];
    }
  }
  return [];
};

export const parseOptions = (optionsField: any): any[] => {
  if (Array.isArray(optionsField)) return optionsField;
  if (typeof optionsField === 'string' && optionsField.trim()) {
    try {
      const parsed = JSON.parse(optionsField);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {}
  }
  return [];
};
