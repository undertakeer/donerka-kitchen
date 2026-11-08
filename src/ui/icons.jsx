const P = (props) => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2.2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props} />
)
export const IconCheck = (p) => <P {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></P>
export const IconPlus = (p) => <P {...p}><path d="M12 5v14M5 12h14" /></P>
export const IconChevronL = (p) => <P {...p}><path d="M15 5l-7 7 7 7" /></P>
export const IconChevronR = (p) => <P {...p}><path d="M9 5l7 7-7 7" /></P>
export const IconChevronDown = (p) => <P {...p}><path d="M5 9l7 7 7-7" /></P>
export const IconUp = (p) => <P {...p}><path d="M6 15l6-6 6 6" /></P>
export const IconDown = (p) => <P {...p}><path d="M6 9l6 6 6-6" /></P>
export const IconToday = (p) => <P {...p}><rect x="3.5" y="4.5" width="17" height="16" rx="3" /><path d="M8 2.5v4M16 2.5v4M3.5 9.5h17M8 14l2.5 2.5L16 12" /></P>
export const IconRepeat = (p) => <P {...p}><path d="M17 2.5l3 3-3 3" /><path d="M4 11.5v-1a5 5 0 015-5h11" /><path d="M7 21.5l-3-3 3-3" /><path d="M20 12.5v1a5 5 0 01-5 5H4" /></P>
export const IconMore = (p) => <P {...p}><path d="M4 7h16M4 12h16M4 17h16" /></P>
export const IconNote = (p) => <P {...p}><path d="M5 4h14v12l-4 4H5z" /><path d="M9 9h6M9 13h4" /></P>
export const IconClock = (p) => <P {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></P>
export const IconUser = (p) => <P {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></P>
export const IconTrash = (p) => <P {...p}><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13" /></P>
export const IconCloudOff = (p) => <P {...p}><path d="M3 3l18 18" /><path d="M8 7.5A5.5 5.5 0 0117.5 10 4 4 0 0119 17.6M16 18H7a4.5 4.5 0 01-1.5-8.7" /></P>
export const IconX = (p) => <P {...p}><path d="M6 6l12 12M18 6L6 18" /></P>
