import { useMemo } from 'react'
import { opsParaSvg } from '@/core/render/svg'
import type { DrawOp } from '@/core/render/tipos'

/**
 * Previa das `DrawOp[]` em SVG.
 *
 * Delega a `opsParaSvg` de propósito, em vez de montar elementos React
 * equivalentes. Duas implementacoes de SVG -- uma para a tela, outra para a
 * impressao -- iam divergir, e o usuario veria uma coisa e imprimiria outra.
 * Com uma so, um defeito aparece nos dois lugares ao mesmo tempo.
 *
 * O HTML aqui e gerado pelo proprio `opsParaSvg` a partir de dados tipados,
 * com escape de XML no texto -- nao ha entrada externa passando direto.
 */
export default function DrawOps({ ops }: { ops: DrawOp[] }) {
  const svg = useMemo(() => opsParaSvg(ops), [ops])
  return <g dangerouslySetInnerHTML={{ __html: svg }} />
}
