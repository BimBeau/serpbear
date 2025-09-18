import type { NextApiRequest, NextApiResponse } from 'next';
import { Op } from 'sequelize';
import db from '../../database/database';
import Keyword from '../../database/models/keyword';
import { getAppSettings } from './settings';
import verifyUser from '../../utils/verifyUser';
import parseKeywords from '../../utils/parseKeywords';
import { integrateKeywordSCData, readLocalSCData } from '../../utils/searchConsole';
import refreshAndUpdateKeywords from '../../utils/refresh';
import { getKeywordsVolume, updateKeywordsVolumeData } from '../../utils/adwords';
import countries from '../../utils/countries';

type KeywordsGetResponse = {
   keywords?: KeywordType[],
   error?: string|null,
}

type KeywordsDeleteRes = {
   domainRemoved?: number,
   keywordsRemoved?: number,
   error?: string|null,
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   const authorized = verifyUser(req, res);
   if (authorized !== 'authorized') {
      return res.status(401).json({ error: authorized });
   }

   if (req.method === 'GET') {
      return getKeywords(req, res);
   }
   if (req.method === 'POST') {
      return addKeywords(req, res);
   }
   if (req.method === 'DELETE') {
      return deleteKeywords(req, res);
   }
   if (req.method === 'PUT') {
      return updateKeywords(req, res);
   }
   return res.status(502).json({ error: 'Unrecognized Route.' });
}

const getKeywords = async (req: NextApiRequest, res: NextApiResponse<KeywordsGetResponse>) => {
   if (!req.query.domain && typeof req.query.domain !== 'string') {
      return res.status(400).json({ error: 'Domain is Required!' });
   }
   const settings = await getAppSettings();
   const domain = (req.query.domain as string);
   const integratedSC = process.env.SEARCH_CONSOLE_PRIVATE_KEY && process.env.SEARCH_CONSOLE_CLIENT_EMAIL;
   const { search_console_client_email, search_console_private_key } = settings;
   const domainSCData = integratedSC || (search_console_client_email && search_console_private_key) ? await readLocalSCData(domain) : false;

   try {
      const allKeywords:Keyword[] = await Keyword.findAll({ where: { domain } });
      const keywords: KeywordType[] = parseKeywords(allKeywords.map((e) => e.get({ plain: true })));
      const processedKeywords = keywords.map((keyword) => {
         const historyArray = Object.keys(keyword.history).map((dateKey:string) => ({
            date: new Date(dateKey).getTime(),
            dateRaw: dateKey,
            position: keyword.history[dateKey],
         }));
         const historySorted = historyArray.sort((a, b) => a.date - b.date);
         const lastWeekHistory :KeywordHistory = {};
         historySorted.slice(-7).forEach((x:any) => { lastWeekHistory[x.dateRaw] = x.position; });
         const keywordWithSlimHistory = { ...keyword, lastResult: [], history: lastWeekHistory };
         const finalKeyword = domainSCData ? integrateKeywordSCData(keywordWithSlimHistory, domainSCData) : keywordWithSlimHistory;
         return finalKeyword;
      });
      return res.status(200).json({ keywords: processedKeywords });
   } catch (error) {
      console.log('[ERROR] Getting Domain Keywords for ', domain, error);
      return res.status(400).json({ error: 'Error Loading Keywords for this Domain.' });
   }
};

const addKeywords = async (req: NextApiRequest, res: NextApiResponse<KeywordsGetResponse>) => {
   const { keywords } = req.body;
   if (keywords && Array.isArray(keywords) && keywords.length > 0) {
      // const keywordsArray = keywords.replaceAll('\n', ',').split(',').map((item:string) => item.trim());
      const keywordsToAdd: any = []; // QuickFIX for bug: https://github.com/sequelize/sequelize-typescript/issues/936

      keywords.forEach((kwrd: KeywordAddPayload) => {
         const { keyword, device, country, domain, tags, city } = kwrd;
         const tagsArray = tags ? tags.split(',').map((item:string) => item.trim()) : [];
         const newKeyword = {
            keyword,
            device,
            domain,
            country,
            city,
            position: 0,
            updating: true,
            history: JSON.stringify({}),
            url: '',
            tags: JSON.stringify(tagsArray),
            sticky: false,
            lastUpdated: new Date().toJSON(),
            added: new Date().toJSON(),
         };
         keywordsToAdd.push(newKeyword);
      });

      try {
         const newKeywords:Keyword[] = await Keyword.bulkCreate(keywordsToAdd);
         const formattedkeywords = newKeywords.map((el) => el.get({ plain: true }));
         const keywordsParsed: KeywordType[] = parseKeywords(formattedkeywords);

         // Queue the SERP Scraping Process
         const settings = await getAppSettings();
         refreshAndUpdateKeywords(newKeywords, settings);

         // Update the Keyword Volume
         const { adwords_account_id, adwords_client_id, adwords_client_secret, adwords_developer_token } = settings;
         if (adwords_account_id && adwords_client_id && adwords_client_secret && adwords_developer_token) {
            const keywordsVolumeData = await getKeywordsVolume(keywordsParsed);
            if (keywordsVolumeData.volumes !== false) {
               await updateKeywordsVolumeData(keywordsVolumeData.volumes);
            }
         }

         return res.status(201).json({ keywords: keywordsParsed });
      } catch (error) {
         console.log('[ERROR] Adding New Keywords ', error);
         return res.status(400).json({ error: 'Could Not Add New Keyword!' });
      }
   } else {
      return res.status(400).json({ error: 'Necessary Keyword Data Missing' });
   }
};

const deleteKeywords = async (req: NextApiRequest, res: NextApiResponse<KeywordsDeleteRes>) => {
   if (!req.query.id && typeof req.query.id !== 'string') {
      return res.status(400).json({ error: 'keyword ID is Required!' });
   }
   console.log('req.query.id: ', req.query.id);

   try {
      const keywordsToRemove = (req.query.id as string).split(',').map((item) => parseInt(item, 10));
      const removeQuery = { where: { ID: { [Op.in]: keywordsToRemove } } };
      const removedKeywordCount: number = await Keyword.destroy(removeQuery);
      return res.status(200).json({ keywordsRemoved: removedKeywordCount });
   } catch (error) {
      console.log('[ERROR] Removing Keyword. ', error);
      return res.status(400).json({ error: 'Could Not Remove Keyword!' });
   }
};

const allowedDevices = ['desktop', 'mobile'];

const isValidUrl = (value: string) => {
   if (!value) { return true; }
   try {
      const parsed = new URL(value);
      return ['http:', 'https:'].includes(parsed.protocol);
   } catch (err) {
      return false;
   }
};

const updateKeywords = async (req: NextApiRequest, res: NextApiResponse<KeywordsGetResponse>) => {
   if (!req.query.id || typeof req.query.id !== 'string') {
      return res.status(400).json({ error: 'keyword ID is Required!' });
   }

   const keywordIDs = (req.query.id as string).split(',').map((item) => parseInt(item, 10));
   const { sticky } = req.body;
   const tagsPayload = req.body.tags;
   const { keyword: newKeyword, url, country, city, device } = req.body;
   const hasSingleKeywordUpdate = [newKeyword, url, country, city, device, Array.isArray(tagsPayload) ? tagsPayload : undefined]
      .some((item) => item !== undefined);

   if (sticky === undefined && tagsPayload === undefined && !hasSingleKeywordUpdate) {
      return res.status(400).json({ error: 'keyword Payload Missing!' });
   }

   try {
      let keywords: KeywordType[] = [];
      if (sticky !== undefined) {
         if (typeof sticky !== 'boolean') {
            return res.status(400).json({ error: 'Sticky should be a boolean value.' });
         }
         await Keyword.update({ sticky }, { where: { ID: { [Op.in]: keywordIDs } } });
         const updateQuery = { where: { ID: { [Op.in]: keywordIDs } } };
         const updatedKeywords:Keyword[] = await Keyword.findAll(updateQuery);
         const formattedKeywords = updatedKeywords.map((el) => el.get({ plain: true }));
         keywords = parseKeywords(formattedKeywords);
         return res.status(200).json({ keywords });
      }

      if (tagsPayload && typeof tagsPayload === 'object' && !Array.isArray(tagsPayload)) {
         const tagsKeywordIDs = Object.keys(tagsPayload);
         const multipleKeywords = tagsKeywordIDs.length > 1;
         for (const keywordID of tagsKeywordIDs) {
            const selectedKeyword = await Keyword.findOne({ where: { ID: keywordID } });
            const currentTags = selectedKeyword && selectedKeyword.tags ? JSON.parse(selectedKeyword.tags) : [];
            const mergedTags = Array.from(new Set([...currentTags, ...tagsPayload[keywordID]]));
            if (selectedKeyword) {
               await selectedKeyword.update({ tags: JSON.stringify(multipleKeywords ? mergedTags : tagsPayload[keywordID]) });
            }
         }
         return res.status(200).json({ keywords });
      }

      if (hasSingleKeywordUpdate) {
         if (keywordIDs.length !== 1 || Number.isNaN(keywordIDs[0])) {
            return res.status(400).json({ error: 'A single valid keyword ID is required to update keyword data.' });
         }

         const keywordID = keywordIDs[0];
         const updatePayload: Record<string, string> = {};

         if (newKeyword !== undefined) {
            if (typeof newKeyword !== 'string' || !newKeyword.trim()) {
               return res.status(400).json({ error: 'Keyword is required.' });
            }
            updatePayload.keyword = newKeyword.trim();
         }

         if (url !== undefined) {
            if (typeof url !== 'string') {
               return res.status(400).json({ error: 'URL should be a string.' });
            }
            const trimmedUrl = url.trim();
            if (trimmedUrl && !isValidUrl(trimmedUrl)) {
               return res.status(400).json({ error: 'Invalid URL provided.' });
            }
            updatePayload.url = trimmedUrl;
         }

         if (country !== undefined) {
            if (typeof country !== 'string') {
               return res.status(400).json({ error: 'Invalid country provided.' });
            }
            const sanitizedCountry = country.toUpperCase();
            if (!countries[sanitizedCountry]) {
               return res.status(400).json({ error: 'Invalid country provided.' });
            }
            updatePayload.country = sanitizedCountry;
         }

         if (city !== undefined) {
            if (city !== null && typeof city !== 'string') {
               return res.status(400).json({ error: 'Invalid city provided.' });
            }
            const trimmedCity = city ? city.trim() : '';
            if (trimmedCity.length > 120) {
               return res.status(400).json({ error: 'City should be 120 characters or fewer.' });
            }
            updatePayload.city = trimmedCity;
         }

         if (device !== undefined) {
            if (typeof device !== 'string') {
               return res.status(400).json({ error: 'Invalid device provided.' });
            }
            const sanitizedDevice = device.toLowerCase();
            if (!allowedDevices.includes(sanitizedDevice)) {
               return res.status(400).json({ error: 'Invalid device provided.' });
            }
            updatePayload.device = sanitizedDevice;
         }

         if (Array.isArray(tagsPayload)) {
            const allValidTags = tagsPayload.every((tag) => typeof tag === 'string');
            if (!allValidTags) {
               return res.status(400).json({ error: 'Invalid tags payload.' });
            }
            const formattedTags = Array.from(new Set(tagsPayload.map((tag) => tag.trim()).filter((tag) => !!tag)));
            updatePayload.tags = JSON.stringify(formattedTags);
         }

         if (Object.keys(updatePayload).length === 0) {
            return res.status(400).json({ error: 'No valid fields provided to update.' });
         }

         updatePayload.lastUpdated = new Date().toJSON();

         await Keyword.update(updatePayload, { where: { ID: keywordID } });
         const updatedKeyword = await Keyword.findOne({ where: { ID: keywordID } });
         if (!updatedKeyword) {
            return res.status(404).json({ error: 'Keyword not found.' });
         }
         const formattedKeyword = updatedKeyword.get({ plain: true });
         const [parsedKeyword] = parseKeywords([formattedKeyword]);
         return res.status(200).json({ keywords: parsedKeyword ? [parsedKeyword] : [] });
      }

      return res.status(400).json({ error: 'Invalid Payload!' });
   } catch (error) {
      console.log('[ERROR] Updating Keyword. ', error);
      return res.status(200).json({ error: 'Error Updating keywords!' });
   }
};
