export async function activeMultiplier(prisma, stationId, at = new Date()) {
  const rules = await prisma.pricingRule.findMany({ where: { stationId, isActive: true } });
  const day = at.getDay();
  const minutes = at.getHours() * 60 + at.getMinutes();
  return rules.reduce((max, rule) => {
    if (!rule.daysOfWeek.includes(day)) return max;
    const start = rule.startTime.getUTCHours() * 60 + rule.startTime.getUTCMinutes();
    const end = rule.endTime.getUTCHours() * 60 + rule.endTime.getUTCMinutes();
    const matches =
      end >= start ? minutes >= start && minutes < end : minutes >= start || minutes < end;
    return matches ? Math.max(max, Number(rule.priceMultiplier)) : max;
  }, 1);
}
