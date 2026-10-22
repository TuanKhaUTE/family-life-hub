import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActivityPlans } from './ActivityPlans'
function network(kind: 'STUDY'|'FITNESS', failure=false) {
  let plan: Record<string,unknown>|null=null
  const calls: {url:string;init?:RequestInit}[]=[]
  vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{
    calls.push({url,init})
    if(failure)throw new Error('private network details')
    if(init?.method==='POST'&&!url.endsWith('/completion')) { const input=JSON.parse(String(init.body));plan={...input,id:input.requestId,kind,completedAt:null,actualMinutes:null,completionNote:null,cancelled:false}; return new Response(JSON.stringify({id:input.requestId})) }
    if(url.endsWith('/completion')) { plan={...plan,completedAt:'2026-03-02T14:00:00Z',actualMinutes:JSON.parse(String(init?.body)).durationMinutes};return new Response(null,{status:204}) }
    return new Response(JSON.stringify({activities:{plans:plan?[plan]:[],progress:{today:{minutes:plan?.actualMinutes??0,sessions:plan?.completedAt?1:0},week:{minutes:plan?.actualMinutes??0,sessions:plan?.completedAt?1:0,previousMinutes:0,previousSessions:0,differenceMinutes:plan?.actualMinutes??0,differenceSessions:plan?.completedAt?1:0,percentage:null},month:{minutes:plan?.actualMinutes??0,sessions:plan?.completedAt?1:0,previousMinutes:0,previousSessions:0,differenceMinutes:plan?.actualMinutes??0,differenceSessions:plan?.completedAt?1:0,percentage:null},consistency:{planned:plan?1:0,completed:plan?.completedAt?1:0,streak:plan?.completedAt?1:0}}}}))
  }))
  return calls
}
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
describe('Study and Fitness PLAN → COMPLETE → PROGRESS',()=>{
  it.each(['STUDY','FITNESS'] as const)('%s plans stay at zero until actual completion and support correction',async kind=>{
    const calls=network(kind)
    render(<ActivityPlans kind={kind}/> )
    await userEvent.click(await screen.findByRole('button',{name:kind==='STUDY'?'Lên lịch buổi học':'Lên lịch buổi tập'}))
    fireEvent.change(screen.getByLabelText('Tên môn / nội dung'),{target:{value:'Nội dung thử nghiệm tự chọn'}})
    fireEvent.change(screen.getByLabelText('Ngày'),{target:{value:'2026-03-02'}})
    fireEvent.change(screen.getByLabelText('Bắt đầu'),{target:{value:'19:00'}})
    fireEvent.change(screen.getByLabelText('Kết thúc'),{target:{value:'21:00'}})
    await userEvent.click(screen.getByRole('button',{name:'Lưu kế hoạch'}))
    expect(await screen.findByText('Chưa hoàn thành')).toBeTruthy()
    expect(screen.getByText('Hôm nay: 0 phút · 0 buổi')).toBeTruthy()
    await userEvent.click(screen.getByRole('button',{name:kind==='STUDY'?'Hoàn thành buổi học':'Hoàn thành buổi tập'}))
    expect((screen.getByLabelText('Thời lượng thực tế (phút)') as HTMLInputElement).value).toBe('120')
    fireEvent.change(screen.getByLabelText('Thời lượng thực tế (phút)'),{target:{value:'90'}})
    await userEvent.click(screen.getByRole('button',{name:'Xác nhận hoàn thành'}))
    expect(await screen.findByText('Hôm nay: 90 phút · 1 buổi')).toBeTruthy()
    expect(screen.getByText('1 buổi đúng kế hoạch liên tiếp 🔥')).toBeTruthy()
    expect(calls.filter(c=>c.url.endsWith('/completion'))).toHaveLength(1)
    await userEvent.click(screen.getByRole('button',{name:'Sửa thời lượng thực tế'}))
    fireEvent.change(screen.getByLabelText('Thời lượng thực tế (phút)'),{target:{value:'100'}})
    await userEvent.click(screen.getByRole('button',{name:'Lưu thời lượng thực tế'}))
    expect(await screen.findByText('Hôm nay: 100 phút · 1 buổi')).toBeTruthy()
    expect(calls.find(c=>c.init?.method==='PATCH')!.url).toContain('/completion')
  })
  it('keeps errors safe and retryable',async()=>{
    network('STUDY',true);render(<ActivityPlans kind="STUDY"/> )
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByText(/private network/)).toBeNull()
    network('STUDY');await userEvent.click(screen.getByRole('button',{name:'Tải lại kế hoạch'}))
    expect(await screen.findByText('Chưa có buổi nào được lên lịch.')).toBeTruthy()
  })
})
