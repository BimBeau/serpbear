import countries from '../../utils/countries';
import { encodeUULE } from '../../utils/uule';

const scrapingRobot:ScraperSettings = {
   id: 'scrapingrobot',
   name: 'Scraping Robot',
   website: 'scrapingrobot.com',
   allowsCity: true,
   scrapeURL: (keyword, settings, countryData) => {
      const country = keyword.country || 'US';
      const device = keyword.device === 'mobile' ? '&mobile=true' : '';
      const lang = countryData[country][2];
      const countryName = countries[country]?.[0];
      const cityValue = keyword.city?.trim();
      const uuleLocation = cityValue && countryName ? `${cityValue}, ${countryName}` : cityValue;
      const uule = uuleLocation ? encodeUULE(uuleLocation) : '';
      const locationParam = uule ? `&uule=${uule}` : '';
      const url = encodeURI(`https://www.google.com/search?num=100&hl=${lang}&q=${keyword.keyword}${locationParam}`);
      return `https://api.scrapingrobot.com/?token=${settings.scaping_api}&proxyCountry=${country}&render=false${device}&url=${url}`;
   },
   resultObjectKey: 'result',
};

export default scrapingRobot;
