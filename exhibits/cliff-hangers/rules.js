export const LIMIT = 25;
export function assessGuess(position, guess, price) {
  if (![position, guess, price].every(Number.isInteger) || position < 0 || position > LIMIT || guess < 0 || price < 0) throw new RangeError('Invalid price or position');
  const error = Math.abs(guess - price);
  const requestedPosition = position + error;
  return {guess, price, error, start: position, end: Math.min(LIMIT + 1, requestedPosition), fell: requestedPosition > LIMIT};
}
export const PRODUCTS = [
  {id:0,name:'Digital kitchen timer',short:'Kitchen timer',description:'A magnetic countdown timer with a large digital display.',category:'FOR THE KITCHEN',price:19},
  {id:1,name:'Manual citrus juicer',short:'Citrus juicer',description:'A countertop citrus press with a measuring cup and removable strainer.',category:'A FRESH START',price:22},
  {id:2,name:'Insulated travel mug',short:'Travel mug',description:'A 20-ounce stainless-steel mug with a sliding, spill-resistant lid.',category:'ON THE GO',price:24},
  {id:3,name:'Electric coffee grinder',short:'Coffee grinder',description:'A compact grinder with a bean hopper and removable grounds cup.',category:'MORNING ROUTINE',price:31},
  {id:4,name:'Electric kettle',short:'Electric kettle',description:'A 1.7-liter cordless kettle with automatic shutoff.',category:'TEA TIME',price:35},
  {id:5,name:'Mini waffle maker',short:'Waffle maker',description:'A compact, nonstick waffle maker with an indicator light.',category:'BREAKFAST IS SERVED',price:38},
  {id:6,name:'Electric hand mixer',short:'Hand mixer',description:'A five-speed hand mixer with two stainless-steel beaters.',category:'READY TO BAKE',price:43},
  {id:7,name:'Personal blender',short:'Personal blender',description:'A single-serve blender with a 20-ounce travel cup and lid.',category:'BLEND & GO',price:49},
  {id:8,name:'Two-slice toaster',short:'Two-slice toaster',description:'A wide-slot toaster with six browning settings and a crumb tray.',category:'A LITTLE GOLDEN BROWN',price:56}
];
export function choosePrizes(random = Math.random) {
  return [0,3,6].map(start => PRODUCTS[start + Math.floor(random() * 3)]);
}
