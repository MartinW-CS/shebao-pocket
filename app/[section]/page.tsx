import BenefitApp from '@/components/benefit-app';
import {notFound} from 'next/navigation';
export default async function Page({params}:{params:Promise<{section:string}>}){const {section}=await params;if(!['pension','medical','fund','maternity','unemployment','injury','gap','compare','flex','profile','policies'].includes(section))notFound();return <BenefitApp section={section}/>}
