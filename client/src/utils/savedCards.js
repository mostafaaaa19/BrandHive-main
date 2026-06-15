// Re-export server-backed saved card helpers from api.js
export {
  fetchSavedCards as loadSavedCards,
  addSavedCard,
  removeSavedCard,
  setDefaultSavedCard,
} from '../services/api';

export const SAVED_CARDS_KEY = 'brandhive_saved_cards';

export const saveSavedCards = () => {
  console.warn('saveSavedCards is deprecated — use addSavedCard/removeSavedCard APIs');
};

export const getDefaultSavedCard = async (userId) => {
  const { fetchSavedCards } = await import('../services/api');
  const cards = await fetchSavedCards(userId);
  return cards.find((card) => card.isDefault) || cards[0] || null;
};
