// Estado global do carrinho
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CarrinhoContext = createContext(null);

function lerCarrinho() {
  try {
    return JSON.parse(localStorage.getItem('carrinho')) || [];
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
    setLinhas((atual) => {
      const existe = atual.find((l) => l.produto._id === produto._id);
      if (existe) {
        return atual.map((l) => l.produto._id === produto._id
          ? { ...l, quantidade: l.quantidade + quantidade } : l);
      }
      return [...atual, { produto, quantidade }];
    });
  }

  function alterarQuantidade(produtoId, quantidade) {
    setLinhas((atual) => {
      // Quantidade inferior a 1 remove o produto
      if (quantidade < 1) {
        return atual.filter((l) => l.produto._id !== produtoId
        );
      }

      return atual.map((l) => l.produto._id === produtoId
          ? {...l, quantidade} : l
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

  // TODO: alterar quantidade, esvaziar após encomendar, agrupar por produtor
  const total = useMemo(
    () => linhas.reduce((s, l) => s + l.produto.preco * l.quantidade, 0), [linhas]);

  return (
    <CarrinhoContext.Provider value={{ linhas, adicionar, alterarQuantidade, remover, esvaziar, total }}>
      {children}
    </CarrinhoContext.Provider>
  );
}

export const useCarrinho = () => useContext(CarrinhoContext);
