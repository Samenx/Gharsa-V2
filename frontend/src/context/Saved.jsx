import {createContext,useContext,useEffect,useState} from 'react';
import {api} from '../api/client';
import {useStore} from './Store';
const Context=createContext();
const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'[]').filter(Number.isInteger)}catch{return []}};
export function SavedProvider({children}){
 const {user,notify}=useStore();const [wishlist,setWishlist]=useState(()=>read('gharsa_wishlist')),[compare,setCompare]=useState(()=>read('gharsa_compare').slice(0,3));
 useEffect(()=>{let live=true;if(user){(async()=>{const guests=read('gharsa_wishlist');for(const id of guests)await api('/wishlist/'+id,{method:'POST'});const rows=await api('/wishlist');if(live){setWishlist(rows.map(p=>p.id));localStorage.removeItem('gharsa_wishlist')}})().catch(e=>notify(e.message));}else setWishlist(read('gharsa_wishlist'));return()=>{live=false}},[user?.id]);
 const save=async id=>{const exists=wishlist.includes(id);try{if(user)await api('/wishlist/'+id,{method:exists?'DELETE':'POST'});const next=exists?wishlist.filter(x=>x!==id):[...wishlist,id];setWishlist(next);if(!user)localStorage.setItem('gharsa_wishlist',JSON.stringify(next));notify(exists?'Removed from wishlist':'Saved to your wishlist');}catch(e){notify(e.message)}};
 const compareProduct=id=>{let next;if(compare.includes(id))next=compare.filter(x=>x!==id);else{if(compare.length>=3)return notify('Compare up to three plants. Remove one to add another.');next=[...compare,id]}setCompare(next);localStorage.setItem('gharsa_compare',JSON.stringify(next));};
 return <Context.Provider value={{wishlist,save,compare,compareProduct}}>{children}</Context.Provider>;
}
export const useSaved=()=>useContext(Context);
