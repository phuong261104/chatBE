export const generateRandomString = (length: number): string => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  let result = '';
  const randomBuffer = new Uint32Array(length);

  crypto.getRandomValues(randomBuffer);

  for (let i = 0; i < length; i++) {
    result += characters[randomBuffer[i] % charactersLength];
  }

  return result;
};