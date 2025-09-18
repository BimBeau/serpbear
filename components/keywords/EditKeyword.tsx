import React, { useMemo, useRef, useState } from 'react';
import Icon from '../common/Icon';
import Modal from '../common/Modal';
import SelectField from '../common/SelectField';
import countries from '../../utils/countries';
import { useEditKeyword } from '../../services/keywords';

const allowedDevices = ['desktop', 'mobile'];

type EditKeywordProps = {
   keyword: KeywordType,
   closeModal: () => void,
   domain: string,
   availableTags: string[],
   allowsCity: boolean,
   scraperName?: string,
};

type FormState = {
   keyword: string,
   url: string,
   country: string,
   device: string,
   city: string,
   tags: string,
};

const EditKeyword = ({ keyword, closeModal, domain, availableTags, allowsCity, scraperName = '' }: EditKeywordProps) => {
   const [formState, setFormState] = useState<FormState>({
      keyword: keyword.keyword || '',
      url: keyword.url || '',
      country: keyword.country || 'US',
      device: (keyword.device || 'desktop').toLowerCase(),
      city: keyword.city || '',
      tags: keyword.tags && keyword.tags.length > 0 ? keyword.tags.join(', ') : '',
   });
   const [error, setError] = useState('');
   const [showTagSuggestions, setShowTagSuggestions] = useState(false);
   const inputRef = useRef<HTMLInputElement | null>(null);

   const { mutate: editKeyword, isLoading } = useEditKeyword(domain, () => closeModal());

   const normalizedTags = useMemo(() => {
      return availableTags.filter((tag) => tag && tag.trim() !== '');
   }, [availableTags]);

   const updateDevice = (device: string) => {
      setFormState((prev) => ({ ...prev, device }));
   };

   const onSubmit = () => {
      const trimmedKeyword = formState.keyword.trim();
      if (!trimmedKeyword) {
         setError('Keyword is required.');
         setTimeout(() => setError(''), 3000);
         return;
      }

      if (!formState.country || !countries[formState.country]) {
         setError('Please select a valid country.');
         setTimeout(() => setError(''), 3000);
         return;
      }

      if (!allowedDevices.includes(formState.device)) {
         setError('Please choose a valid device.');
         setTimeout(() => setError(''), 3000);
         return;
      }

      const tagsArray = formState.tags.split(',').map((tag) => tag.trim()).filter((tag) => !!tag);

      const payload: KeywordUpdatePayload = {
         keyword: trimmedKeyword,
         url: formState.url.trim(),
         country: formState.country,
         device: formState.device,
         city: formState.city.trim(),
         tags: tagsArray,
      };

      editKeyword({ keywordID: keyword.ID, payload });
   };

   const existingTagSuggestions = useMemo(() => {
      const currentTags = formState.tags.split(',').map((tag) => tag.trim());
      return normalizedTags.filter((tag) => !currentTags.includes(tag));
   }, [normalizedTags, formState.tags]);

   const deviceTabStyle = 'cursor-pointer px-2 py-2 rounded';
   const cityTitle = allowsCity
      ? ''
      : `Your scraper ${scraperName || 'configuration'} doesn't have city level scraping feature.`;
   const cityPlaceholder = allowsCity
      ? 'City (Optional)'
      : `City editing is unavailable for ${scraperName || 'this scraper'}.`;
   const cityInputClasses = useMemo(() => (
      [
         'w-full',
         'border',
         'rounded',
         'border-gray-200',
         'py-2',
         'px-4',
         'pl-8',
         'outline-none',
         'focus:border-indigo-300',
         !allowsCity ? 'cursor-not-allowed bg-gray-100' : '',
      ].filter(Boolean).join(' ')
   ), [allowsCity]);

   return (
      <Modal closeModal={() => closeModal()} title='Edit Keyword' width='[420px]'>
         <div data-testid='editkeyword_modal'>
            <div className='grid gap-3'>
               <div>
                  <label className='block text-sm font-semibold text-gray-700 mb-1'>Keyword</label>
                  <input
                     className='w-full border rounded border-gray-200 py-2 px-4 outline-none focus:border-indigo-300'
                     value={formState.keyword}
                     onChange={(e) => setFormState({ ...formState, keyword: e.target.value })}
                     placeholder='Keyword'
                  />
               </div>
               <div>
                  <label className='block text-sm font-semibold text-gray-700 mb-1'>URL</label>
                  <input
                     className='w-full border rounded border-gray-200 py-2 px-4 outline-none focus:border-indigo-300'
                     value={formState.url}
                     onChange={(e) => setFormState({ ...formState, url: e.target.value })}
                     placeholder='https://example.com/path'
                  />
               </div>
               <div className='flex justify-between text-sm'>
                  <div>
                     <SelectField
                        multiple={false}
                        selected={[formState.country]}
                        options={Object.keys(countries).map((countryISO:string) => ({
                           label: countries[countryISO][0],
                           value: countryISO,
                        }))}
                        defaultLabel='Country'
                        updateField={(updated:string[]) => {
                           if (updated[0]) {
                              setFormState({ ...formState, country: updated[0] });
                           }
                        }}
                        rounded='rounded'
                        maxHeight={48}
                        flags
                     />
                  </div>
                  <ul className='flex text-xs font-semibold text-gray-500'>
                     <li
                        className={`${deviceTabStyle} mr-2 ${formState.device === 'desktop' ? 'bg-indigo-50 text-indigo-700' : ''}`}
                        onClick={() => updateDevice('desktop')}
                     >
                        <Icon type='desktop' classes='top-[3px]' size={15} />
                        <i className='not-italic hidden lg:inline-block ml-1'>Desktop</i>
                        <Icon type='check' classes='pl-1' size={12} color={formState.device === 'desktop' ? '#4338ca' : '#bbb'} />
                     </li>
                     <li
                        className={`${deviceTabStyle} ${formState.device === 'mobile' ? 'bg-indigo-50 text-indigo-700' : ''}`}
                        onClick={() => updateDevice('mobile')}
                     >
                        <Icon type='mobile' />
                        <i className='not-italic hidden lg:inline-block ml-1'>Mobile</i>
                        <Icon type='check' classes='pl-1' size={12} color={formState.device === 'mobile' ? '#4338ca' : '#bbb'} />
                     </li>
                  </ul>
               </div>
               <div className='relative'>
                  <label className='block text-sm font-semibold text-gray-700 mb-1'>Tags</label>
                  <input
                     ref={inputRef}
                     className='w-full border rounded border-gray-200 py-2 px-4 pl-12 outline-none focus:border-indigo-300'
                     placeholder='Insert Tags (Optional)'
                     value={formState.tags}
                     onChange={(e) => setFormState({ ...formState, tags: e.target.value })}
                  />
                  <span className='absolute text-gray-400 top-9 left-3 cursor-pointer' onClick={() => setShowTagSuggestions(!showTagSuggestions)}>
                     <Icon type='tags' size={16} color={showTagSuggestions ? '#777' : '#aaa'} />
                     <Icon type={showTagSuggestions ? 'caret-up' : 'caret-down'} size={14} color={showTagSuggestions ? '#666' : '#aaa'} />
                  </span>
                  {showTagSuggestions && (
                     <ul className='absolute z-50 bg-white border border-t-0 border-gray-200 rounded rounded-t-none w-full max-h-40 overflow-auto'>
                        {existingTagSuggestions.length > 0 && existingTagSuggestions.map((tag) => (
                           <li
                              className='p-2 cursor-pointer hover:text-indigo-600 hover:bg-indigo-50 transition'
                              key={tag}
                              onClick={() => {
                                 const tagInput = formState.tags;
                                 const trimmedInput = tagInput.trim();
                                 const needsSeparator = trimmedInput !== '' && !trimmedInput.endsWith(',');
                                 const tagToInsert = `${tagInput}${needsSeparator ? ', ' : ''}${tag}`;
                                 setFormState({ ...formState, tags: tagToInsert });
                                 setShowTagSuggestions(false);
                                 if (inputRef.current) {
                                    inputRef.current.focus();
                                 }
                              }}
                           >
                              <Icon type='tags' size={14} color='#bbb' /> {tag}
                           </li>
                        ))}
                        {existingTagSuggestions.length === 0
                           && <li className='p-2 text-sm text-gray-500'>No Existing Tags Found...</li>}
                     </ul>
                  )}
               </div>
               <div className='relative'>
                  <label className='block text-sm font-semibold text-gray-700 mb-1'>City</label>
                  <input
                     className={cityInputClasses}
                     disabled={!allowsCity}
                     title={cityTitle}
                     placeholder={cityPlaceholder}
                     value={formState.city}
                     onChange={(e) => setFormState({ ...formState, city: e.target.value })}
                  />
                  <span className='absolute text-gray-400 top-10 left-2'>
                     <Icon type='city' size={16} />
                  </span>
               </div>
            </div>
            {error && <div className='w-full mt-4 p-3 text-sm bg-red-50 text-red-700'>{error}</div>}
            <div className='mt-6 text-right text-sm font-semibold flex justify-between'>
               <button
                  className='py-2 px-5 rounded cursor-pointer bg-indigo-50 text-slate-500 mr-3'
                  onClick={() => closeModal()}
               >
                  Cancel
               </button>
               <button
                  className='py-2 px-5 rounded cursor-pointer bg-blue-700 text-white disabled:opacity-70'
                  onClick={() => { if (!isLoading) { onSubmit(); } }}
                  disabled={isLoading}
               >
                  {isLoading ? 'Saving...' : 'Save Changes'}
               </button>
            </div>
         </div>
      </Modal>
   );
};

export default EditKeyword;
