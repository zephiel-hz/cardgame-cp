import { useTranslation } from 'react-i18next';
import type { Card } from '@shared/schema';

/**
 * Hook to translate card names and descriptions by card ID
 */
export function useCardTranslation() {
  const { t } = useTranslation();

  const getCardName = (cardId: number): string => {
    return t(`cards:card_${cardId}.name`, { defaultValue: '' });
  };

  const getCardDescription = (cardId: number): string => {
    return t(`cards:card_${cardId}.description`, { defaultValue: '' });
  };

  const getCardNameAndDescription = (
    cardId: number
  ): { name: string; description: string } => {
    return {
      name: getCardName(cardId),
      description: getCardDescription(cardId),
    };
  };

  return {
    getCardName,
    getCardDescription,
    getCardNameAndDescription,
  };
}

/**
 * Localized duration formatter that uses i18n for time units
 */
export function useFormattedDuration() {
  const { t } = useTranslation();

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes}${t('time:minute')}`;
    }

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (mins === 0) {
      return `${hours}${t('time:hour')}`;
    }

    return `${hours}${t('time:hour')} ${mins}${t('time:minute')}`;
  };

  // Format for display (with spaces, like "2 hours 30 minutes")
  const formatDurationFull = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes} ${t('time:minutes')}`;
    }

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (mins === 0) {
      return `${hours} ${t('time:hours')}`;
    }

    return `${hours} ${t('time:hours')} ${mins} ${t('time:minutes')}`;
  };

  // Format time remaining/ago (like "2 hours ago" or "in 2 hours")
  const formatTimeAgo = (minutes: number, isAgo: boolean = true): string => {
    const prep = isAgo ? t('time:ago') : t('time:in');

    if (minutes < 1) {
      return t('time:justNow');
    }

    if (minutes < 60) {
      return `${minutes} ${t('time:minutes')} ${prep}`;
    }

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (mins === 0) {
      return `${hours} ${t('time:hours')} ${prep}`;
    }

    if (hours < 24) {
      return `${hours} ${t('time:hours')} ${mins} ${t('time:minutes')} ${prep}`;
    }

    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;

    if (remainingHours === 0) {
      return `${days} ${t('time:days')} ${prep}`;
    }

    return `${days} ${t('time:days')} ${remainingHours} ${t('time:hours')} ${prep}`;
  };

  return {
    formatDuration,
    formatDurationFull,
    formatTimeAgo,
  };
}
