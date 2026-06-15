export const SAVED_CARDS_KEY = 'brandhive_saved_cards';

export const loadSavedCards = () => {
  if (typeof localStorage === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(SAVED_CARDS_KEY)) || [];
  } catch {
    return [];
  }
};

export const saveSavedCards = (cards) => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(SAVED_CARDS_KEY, JSON.stringify(cards));
};

export const getDefaultSavedCard = () => {
  const cards = loadSavedCards();
  return cards.find((card) => card.isDefault) || cards[0] || null;
};
