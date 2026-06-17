/**
 * Classe d'erreur applicative avec code et status HTTP.
 * Conforme au pattern établi dans l'architecture.
 */
export class AppError extends Error {
  /**
   * @param {string} message - Description de l'erreur
   * @param {object} [options]
   * @param {number} [options.statusCode=500] - Code HTTP
   * @param {string} [options.code='INTERNAL_ERROR'] - Code métier
   */
  constructor(message, { statusCode = 500, code = 'INTERNAL_ERROR' } = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
  }
}
