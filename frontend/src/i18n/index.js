import ar from './ar.json';
export function tr(value) {return localStorage.getItem('gharsa_language')==='ar'?(ar[value]||value):value;}
