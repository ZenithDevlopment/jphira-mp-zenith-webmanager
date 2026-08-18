import RoomClient from "./RoomClient"

export function generateStaticParams() { return [{ id: "__fallback__" }] }

export default function Page() { return <RoomClient id="" /> }
