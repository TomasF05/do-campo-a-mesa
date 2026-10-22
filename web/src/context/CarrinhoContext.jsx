// Estado global do carrinho
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CarrinhoContext = createContext(null);

function lerCarrinho() {
  try {
    const lista = JSON.parse(localStorage.getItem('carrinho'));
    return Array.isArray(lista) ? lista.filter((l) => l?.produto?._id && Number.isFinite(l.produto.preco) && Number.isInteger(l.quantidade) && l.quantidade > 0) : [];
  } catch {
    return [];
  }
}

export function CarrinhoProvider({ children }) {
  const [linhas, setLinhas] = useState(lerCarrinho);  // [{ produto, quantidade }]

  useEffect(() => {
    try {
      localStorage.setItem('carrinho', JSON.stringify(linhas));
    } catch {
      // Caso o localStorage não esteja disponível
    }
  }, [linhas]);

  function adicionar(produto, quantidade = 1) {
    if (!Number.isInteger(quantidade) || quantidade < 1 || produto.stock === 0) return;
    setLinhas((atual) => {
      const existe = atual.find((l) => l.produto._id === produto._id);
      if (existe) {
        return atual.map((l) => l.produto._id === produto._id
          ? { ...l, quantidade: Math.min(l.quantidade + quantidade, produto.stock ?? Infinity) } : l);
      }
      return [...atual, { produto, quantidade: Math.min(quantidade, produto.stock ?? Infinity) }];
    });
  }

  function alterarQuantidade(produtoId, quantidade) {
    if (!Number.isInteger(quantidade)) return;
    setLinhas((atual) => {
      // Quantidade inferior a 1 remove o produto
      if (quantidade < 1) {
        return atual.filter((l) => l.produto._id !== produtoId
        );
      }

      return atual.map((l) => l.produto._id === produtoId
          ? {...l, quantidade: Math.min(quantidade, l.produto.stock ?? Infinity)} : l
      );
    });
  }

  function remover(produtoId) {
    setLinhas((atual) => atual.filter((l) => l.produto._id !== produtoId));
  }

  // Esvazia completamente o carrinho
  function esvaziar() {
    setLinhas([]);
  }

  const total = useMemo(
    () => linhas.reduce((s, l) => s + l.produto.preco * l.quantidade, 0), [linhas]);

  return (
    <CarrinhoContext.Provider value={{ linhas, adicionar, alterarQuantidade, remover, esvaziar, total }}>
      {children}
    </CarrinhoContext.Provider>
  );
}

export const useCarrinho = () => useContext(CarrinhoContext);
