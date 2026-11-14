/** Compare errors for a baseline and a new model on the same held-out observations. */
export function pairedImprovementMae(observed: number[], baseline: number[], model: number[]) {
  if (observed.length === 0 || observed.length !== baseline.length || observed.length !== model.length) {
    throw new Error("Arrays must have identical, non-zero length.");
  }
  const pairedImprovements = observed.map((value, index) =>
    Math.abs(baseline[index] - value) - Math.abs(model[index] - value),
  );
  const baselineMae = observed.reduce((sum, value, index) => sum + Math.abs(baseline[index] - value), 0) / observed.length;
  const modelMae = observed.reduce((sum, value, index) => sum + Math.abs(model[index] - value), 0) / observed.length;
  return {
    pairedImprovements,
    meanImprovementMae: pairedImprovements.reduce((sum, value) => sum + value, 0) / observed.length,
    baselineMae,
    modelMae,
  };
}
