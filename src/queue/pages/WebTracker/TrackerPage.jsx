import React, { useEffect, useState } from 'react'

import * as api from '../../services/api'

import WaitingScreen from '../../components/WaitingScreen.jsx'

import YourTurnScreen from '../../components/YourTurnScreen.jsx'

import CompletedScreen from '../../components/CompletedScreen.jsx'



const POLL_INTERVAL_MS = 30000

/*
 * PREVIEW MODE — for checking the screens without a live ticket.
 *   /tracker?preview=waiting
 *   /tracker?preview=turn
 *   /tracker?preview=completed
 * Add &type=regular to see a regular (non-priority) ticket.
 * Sample data only; never touches the API.
 */
const PREVIEW_STATUS = { waiting: 'waiting', turn: 'serving', completed: 'completed' }

function buildPreviewTicket(mode, regular) {
  return {
    status: PREVIEW_STATUS[mode],
    queueNumber: regular ? 'BP-022' : 'P-BP-021',
    isPriority: !regular,
    department: 'Billing / Payment',
    terminal: 'Terminal 2',
    nowServing: 'BP-016',
    peopleAhead: 5,
    estimatedWaitMinutes: 36,
    totalAheadAtIssue: 10,
  }
}



export default function TrackerPage() {

const [ticket, setTicket] = useState(null)

const [error, setError] = useState(null)



// The QR code now contains the unique queue_id UUID.

const params = new URLSearchParams(window.location.search)

const ticketId = params.get('ticket')

const previewMode = PREVIEW_STATUS[params.get('preview')] ? params.get('preview') : null

const previewTicket = previewMode
  ? buildPreviewTicket(previewMode, params.get('type') === 'regular')
  : null



useEffect(() => {

let cancelled = false



const load = async () => {

if (previewMode) {

return

}

if (!ticketId) {

setError('No ticket number was provided.')

return

}



const result = await api.fetchTicketStatus(ticketId)



if (!cancelled) {

if (result.error) {

setError(result.error)

setTicket(null)

} else {

setError(null)

setTicket(result)

}

}

}



load()



const interval = setInterval(load, POLL_INTERVAL_MS)



return () => {

cancelled = true

clearInterval(interval)

}

}, [ticketId, previewMode])



const shown = previewTicket || ticket

if (!previewTicket && error) {

return (

<div className="flex min-h-screen items-center justify-center bg-[#EAF3FB] px-4">

<div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">

<p className="text-xl font-bold">
<span className="text-[#9D0A0E]">SWU</span>
<span className="text-[#1F2937]">Med</span>
</p>

<h1 className="mt-5 text-xl font-bold text-[#1F2937]">

Ticket Not Found

</h1>

<p className="mt-2 text-sm leading-6 text-[#4B5563]">

{error}

</p>

<p className="mt-5 text-xs text-[#9CA3AF]">

Please scan the QR code on your ticket again, or ask the front desk for help.

</p>

</div>

</div>

)

}



if (!shown) {

return (

<div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#EAF3FB]">

<span
aria-hidden="true"
className="h-8 w-8 animate-spin rounded-full border-4 border-[#F0DADA] border-t-[#9D0A0E]"
/>

<p className="text-sm text-[#4B5563]">

Loading your ticket...

</p>

</div>

)

}



return (

<div className="transition-opacity duration-200 ease-out">

{shown.status === 'completed' ? (

<CompletedScreen ticket={shown} />

) : shown.status === 'called' || shown.status === 'serving' ? (

<YourTurnScreen ticket={shown} />

) : (

<WaitingScreen ticket={shown} />

)}

</div>

)

}