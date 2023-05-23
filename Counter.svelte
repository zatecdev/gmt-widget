<script>
    export let details;

</script>


<div class="item wow fadeInUpBig animated animated" data-number="12" style="visibility: visible;">
    <i class="{details.icon}"></i>
    <p id="number1" class="number">{details.count}</p>
    <span></span>
    <p>{details.caption}</p>
</div>

<style>
.item{
  width: 25%;
  height: 100%;
  padding: 50px 0px;
  text-align: center;
}

.item:nth-child(1){
  background: rgb(16, 31, 46);
}

.item:nth-child(2){
  background: rgb(18, 34, 51);
}

.item:nth-child(3){
  background: rgb(21, 38, 56);
}

.item:nth-child(4){
  background: rgb(23, 44, 66);
}

.item p.number{
  font-size: 40px;
  padding: 0;
  font-weight: bold;
}

.item p{
  color: rgba(255, 255, 255, 0.8);
  font-size: 18px;
  margin: 0;
  padding: 10px;
  font-family: 'Open Sans';
}


.item span{
  width: 60px;
  background: rgba(255, 255, 255, 0.8);
  height: 2px;
  display: block;
  margin: 0 auto;
}


.item i{
  vertical-align: middle;
  font-size: 50px;
  color: rgba(255, 255, 255, 0.8);
}


.item:hover i, .item:hover p{
  color: white;
}

.item:hover span{
  background: white;
}

@media (max-width: 786px){
  .item {
     flex: 0 0 50%;
  }
}

</style>
