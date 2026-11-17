function readLocalDatabase() {
  const keys = [
    'am-professional-v1',
    'avenuex-business-v1'
  ];

  let fallback = {};

  for (const key of keys) {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null');

      if (!saved || typeof saved !== 'object') continue;

      if (
        Array.isArray(saved.products) &&
        saved.products.length > 0
      ) {
        console.log(
          'AVENUEx: Product database found:',
          key,
          saved.products.length
        );

        return saved;
      }

      if (Object.keys(fallback).length === 0) {
        fallback = saved;
      }

    } catch (error) {
      console.error('Database read error:', key, error);
    }
  }

  return fallback;
}
