import AITradingProApp from '../../kriptokeyfi-trading-bot---sinyal-akışı/src/App';
import '../../kriptokeyfi-trading-bot---sinyal-akışı/src/index.css';
import { useSearchParams } from 'react-router-dom';

export default function AITradingProEntry() {
  const [searchParams, setSearchParams] = useSearchParams();
  return <AITradingProApp requestedTab={searchParams.get('tab')} onTabChange={(tab) => setSearchParams((current) => {
    const next = new URLSearchParams(current);
    next.set('tab', tab);
    return next;
  })} />;
}
