import React, { useEffect, useState } from 'react'

import * as api from '../../services/api'

import WaitingScreen from '../../components/WaitingScreen.jsx'

import YourTurnScreen from '../../components/YourTurnScreen.jsx'

import CompletedScreen from '../../components/CompletedScreen.jsx'



const POLL_INTERVAL_MS = 30000



export default function TrackerPage() {

const [ticket, setTicket] = useState(null)

const [error, setError] = useState(null)



// The QR code now contains the unique queue_id UUID.

const ticketId = new URLSearchParams(window.location.search).get('ticket')



useEffect(() => {

let cancelled = false



const load = async () => {

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

}, [ticketId])



if (error) {

return (

<div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">

<div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">

<h1 className="text-xl font-bold text-slate-800">

Ticket Not Found

</h1>

<p className="mt-2 text-sm text-slate-500">

{error}

</p>

</div>

</div>

)

}



if (!ticket) {

return (

<div className="flex min-h-screen items-center justify-center bg-slate-50">

<p className="text-sm text-slate-400">

Loading your ticket...

</p>

</div>

)

}



return (

<div className="transition-opacity duration-200 ease-out">

{ticket.status === 'completed' ? (

<CompletedScreen ticket={ticket} />

) : ticket.status === 'called' || ticket.status === 'serving' ? (

<YourTurnScreen ticket={ticket} />

) : (

<WaitingScreen ticket={ticket} />

)}

</div>

)

}
