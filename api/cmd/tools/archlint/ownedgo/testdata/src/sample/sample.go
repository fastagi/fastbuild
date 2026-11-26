package sample

func work() {}

func owned() {
	//archlint:goroutine ends when work returns
	go work()
}

func unowned() {
	go work() // want `goroutine has no owner`

	// An ordinary comment is not an owner.
	go func() {}() // want `goroutine has no owner`
}
