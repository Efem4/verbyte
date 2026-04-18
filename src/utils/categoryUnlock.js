/**
 * dailyGoal ve firstUseDate'e göre kaç kategori açık olduğunu döner.
 * Her 7 günde 2 kategori eklenir.
 */
export function getUnlockedCategoryCount(dailyGoal, firstUseDate) {
  const initial = dailyGoal <= 5  ? 2
                : dailyGoal <= 10 ? 4
                : dailyGoal <= 15 ? 6
                : Infinity; // 20/gün → hepsi açık
  if (initial === Infinity) return Infinity;
  const weeksPassed = Math.floor(
    (Date.now() - new Date(firstUseDate).getTime()) / (7 * 24 * 60 * 60 * 1000)
  );
  return initial + weeksPassed * 2;
}
