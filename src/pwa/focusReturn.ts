// Where focus goes when the prompt closes: the element focus came from when it entered the prompt.
export function nextReturnFocus<T>(current: T | null, from: T | null, fromInsidePrompt: boolean): T | null {
  return from !== null && !fromInsidePrompt ? from : current;
}
