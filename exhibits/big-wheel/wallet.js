export const STARTING_BANK=1000,SPIN_COST=100;
export function roundPayout(total){return total>0&&total<100?total*2:0;}
export function roundReturn(player,fees=0,extra=0){const scorePayout=player.cash+roundPayout(player.total),payout=scorePayout+extra;return{scorePayout,extra,payout,fees,net:payout-fees};}
export class Wallet{
 constructor(storage){this.storage=storage;this.balance=STARTING_BANK;this.freeSpins=0;try{const saved=JSON.parse(storage.getItem('big-wheel-bank-v1'));if(Number.isSafeInteger(saved?.balance)&&saved.balance>=0&&saved.balance<=1e12)this.balance=saved.balance;if(Number.isInteger(saved?.freeSpins)&&saved.freeSpins>=0&&saved.freeSpins<=99)this.freeSpins=saved.freeSpins;}catch{}}
 change(amount){if(!Number.isSafeInteger(amount)||this.balance+amount<0)return false;this.balance+=amount;this.save();return true;}
 save(){try{this.storage.setItem('big-wheel-bank-v1',JSON.stringify({balance:this.balance,freeSpins:this.freeSpins}));}catch{}}
 addFreeSpin(){if(this.freeSpins>=99)return false;this.freeSpins++;this.save();return true;}
 useFreeSpin(){if(!this.freeSpins)return false;this.freeSpins--;this.save();return true;}
 fresh(){this.balance=STARTING_BANK;this.freeSpins=0;this.save();}
}
