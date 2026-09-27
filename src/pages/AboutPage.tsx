import { Disclaimer } from '../components/Disclaimer'

export function AboutPage() {
  return (
    <div className="flex flex-col gap-7">
      <h1 className="m-0 text-[2rem] sm:text-[2.6rem]">About Level</h1>
      <Disclaimer />
    </div>
  )
}
