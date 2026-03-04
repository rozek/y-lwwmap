/*******************************************************************************
*                                                                              *
*                           LWWMap — Lifecycle Tests                           *
*                                                                              *
*******************************************************************************/

import { describe, test, expect } from 'vitest'
import * as Y                     from 'yjs'
import { LWWMap }                 from '../src/LWWMap'

/**** createLWWMap — creates a fresh Doc, YArray and LWWMap instance ****/

  function createLWWMap () {
    const Doc      = new Y.Doc()
    const YArray   = Doc.getArray('lwwmap') as any
    const Instance = new LWWMap(YArray)
    return { Doc, YArray, Instance }
  }

//----------------------------------------------------------------------------//
//                                   Tests                                    //
//----------------------------------------------------------------------------//

describe('2. Lifecycle — destroy()', () => {

//----------------------------------------------------------------------------//
//                         2.1 Lifecycle — destroy()                          //
//----------------------------------------------------------------------------//

  test('TC-2.1.1 — destroy() unregisters the internal observer', () => {
    const { YArray, Instance } = createLWWMap()

    let fired = false
    Instance.on('change', () => { fired = true })

    Instance.set('probe', 1)
    expect(fired).toBe(true)
    fired = false

    Instance.destroy()

    YArray.push([{ Key:'direct', Value:42, Timestamp:Date.now()*3000 }])
    expect(fired).toBe(false)
  })

  test('TC-2.1.2 — destroy() removes all external change listeners', () => {
    const { Instance } = createLWWMap()

    let count = 0
    Instance.on('change', () => { count++ })

    Instance.set('k', 1)
    expect(count).toBe(1)

    Instance.destroy()

    ;(Instance as any).emit('change', [ new Map() ])
    expect(count).toBe(1)
  })
})
