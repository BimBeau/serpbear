const UULE_PREFIX = 'w+CAIQICI';
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const encodeLength = (length:number): string => {
   if (length <= 0) {
      return 'A';
   }

   let encoded = '';
   let value = length;

   while (value > 0) {
      const remainder = value % 64;
      encoded = `${BASE64_ALPHABET[remainder]}${encoded}`;
      value = Math.floor(value / 64);
   }

   return encoded;
};

export const encodeUULE = (city: string): string => {
   const trimmedCity = city.trim();

   if (!trimmedCity) {
      return '';
   }

   const locationBuffer = Buffer.from(trimmedCity, 'utf8');
   const lengthIndicator = encodeLength(locationBuffer.length);
   const encodedLocation = locationBuffer.toString('base64');

   return `${UULE_PREFIX}${lengthIndicator}${encodedLocation}`;
};

export default encodeUULE;
