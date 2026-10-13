// Los diálogos abiertos, en orden: el de más arriba, el último. Interno del kit
// (lo usa `useDialogBehavior`), no se exporta en el barrel.
//
// 🪤 Todos escuchan el teclado en `document`, y ahí `stopPropagation` no separa a
// un oyente de otro. Con una confirmación abierta dentro de un drawer, Escape
// cerraba los dos. Con la pila, solo responde el de arriba.
// 🪤 Sin imports relativos: los tests lo cargan con Node tal cual (`.ts`).

export type DialogStack = {
  /** Apunta un diálogo que se abre; devuelve su ficha. */
  open: () => symbol;
  /** Lo quita, esté donde esté: un diálogo de debajo puede cerrarse antes. */
  close: (token: symbol) => void;
  /** ¿Es el de más arriba? Solo ese atiende Escape y Tab. */
  isTop: (token: symbol) => boolean;
  size: () => number;
};

export function createDialogStack(): DialogStack {
  const open: symbol[] = [];
  return {
    open: () => {
      const token = Symbol("dialog");
      open.push(token);
      return token;
    },
    close: (token) => {
      const at = open.indexOf(token);
      if (at >= 0) open.splice(at, 1);
    },
    isTop: (token) => open[open.length - 1] === token,
    size: () => open.length,
  };
}

/** La pila de la página: una por documento. */
export const dialogStack = createDialogStack();
