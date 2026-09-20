import { createContext,useContext,useState,useEffect } from 'react';
const Context=createContext();
export function LanguageProvider({children}) {
 const [language,setLanguage]=useState(()=>localStorage.getItem('gharsa_language')==='ar'?'ar':'en');
 useEffect(()=>{document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr';},[language]);
 const changeLanguage=value=>{localStorage.setItem('gharsa_language',value);setLanguage(value);window.location.reload();};
 return <Context.Provider value={{language,setLanguage:changeLanguage,t:(en,ar)=>language==='ar'?ar:en}}>{children}</Context.Provider>;
}
export const useLanguage=()=>useContext(Context);
