import { Disclaimer } from '../components/Disclaimer'

export function ToolPage() {
  return (
    <div className="flex flex-col gap-7">
      <h1 className="m-0 text-[2rem] sm:text-[2.6rem]">Is your home over-assessed?</h1>
      <Disclaimer />
    </div>
  )
}
