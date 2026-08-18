import PoolClient from "./PoolClient"

export function generateStaticParams() { return [{ id: "__fallback__" }] }

export default function Page() { return <PoolClient id="" /> }
